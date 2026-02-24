package com.wifisentry.core

import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Parses a WiGLE CSV v1.4 export into a list of [ScanRecord]s.
 *
 * The WiGLE CSV format has two header lines followed by data rows:
 * ```
 * WigleWifi-1.4,appRelease=...
 * MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,...,Type
 * data rows...
 * ```
 * Only rows with `Type=WIFI` are imported.  Rows are grouped by UTC calendar
 * day using `FirstSeen` so each day becomes one [ScanRecord].
 *
 * RFC 4180 tokeniser handles quoted fields containing commas and escaped quotes.
 */
object WigleParser {

    data class WigleImportResult(
        val records: List<ScanRecord>,
        val importedNetworks: Int,
        val skippedRows: Int,
    )

    private val DATE_FORMATS = listOf(
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd'T'HH:mm:ss",
        "MM/dd/yyyy HH:mm:ss",
        "yyyy-MM-dd",
    ).map { SimpleDateFormat(it, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") } }

    /** Parse [csv] text and return grouped scan records. */
    fun parse(csv: String): WigleImportResult {
        val lines = csv.lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toList()

        if (lines.size < 2) return WigleImportResult(emptyList(), 0, 0)

        // Skip the WigleWifi-1.4 app-metadata line (line 0) and locate the
        // column-header line (first line starting with "MAC," case-insensitive).
        var headerIndex = -1
        for (i in lines.indices) {
            if (lines[i].startsWith("MAC,", ignoreCase = true) ||
                lines[i].startsWith("\"MAC\"", ignoreCase = true)) {
                headerIndex = i
                break
            }
        }
        if (headerIndex < 0) return WigleImportResult(emptyList(), 0, lines.size)

        val headers = tokenise(lines[headerIndex]).map { it.lowercase().trim() }
        val colMac      = headers.indexOf("mac")
        val colSsid     = headers.indexOf("ssid")
        val colAuth     = headers.indexOf("authmode")
        val colSeen     = headers.indexOf("firstseen")
        val colChannel  = headers.indexOf("channel")
        val colRssi     = headers.indexOf("rssi")
        val colLat      = headers.indexOf("currentlatitude")
        val colLon      = headers.indexOf("currentlongitude")
        val colAlt      = headers.indexOf("altitudemeters")
        val colAcc      = headers.indexOf("accuracymeters")
        val colType     = headers.indexOf("type")

        if (colMac < 0 || colSsid < 0) return WigleImportResult(emptyList(), 0, lines.size)

        // Group networks by UTC calendar day
        val byDay = LinkedHashMap<Long, MutableList<ScannedNetwork>>()
        var skipped = 0
        var imported = 0

        for (i in (headerIndex + 1) until lines.size) {
            val line = lines[i]
            if (line.isBlank()) continue
            val cols = tokenise(line)
            if (cols.size <= colMac) { skipped++; continue }

            val type = if (colType >= 0 && colType < cols.size) cols[colType].trim() else "WIFI"
            if (!type.equals("WIFI", ignoreCase = true)) { skipped++; continue }

            val mac   = cols.getOrNull(colMac)?.trim() ?: ""
            val ssid  = cols.getOrNull(colSsid)?.trim() ?: ""
            val auth  = cols.getOrNull(colAuth)?.trim() ?: ""
            val seen  = cols.getOrNull(colSeen)?.trim() ?: ""
            val ch    = cols.getOrNull(colChannel)?.trim()?.toIntOrNull() ?: 0
            val rssi  = cols.getOrNull(colRssi)?.trim()?.toIntOrNull() ?: -100
            val lat   = cols.getOrNull(colLat)?.trim()?.toDoubleOrNull() ?: Double.NaN
            val lon   = cols.getOrNull(colLon)?.trim()?.toDoubleOrNull() ?: Double.NaN
            val alt   = cols.getOrNull(colAlt)?.trim()?.toDoubleOrNull() ?: Double.NaN
            val acc   = cols.getOrNull(colAcc)?.trim()?.toFloatOrNull() ?: Float.NaN

            if (mac.isBlank()) { skipped++; continue }

            val timestamp = parseDate(seen)
            if (timestamp == null) { skipped++; continue }

            val dayKey = utcDayKey(timestamp)
            val freq   = channelToFreq(ch)

            val network = ScannedNetwork(
                ssid          = ssid,
                bssid         = mac,
                capabilities  = auth,
                rssi          = rssi,
                frequency     = freq,
                timestamp     = timestamp,
                latitude      = lat,
                longitude     = lon,
                altitude      = alt,
                gpsAccuracy   = acc,
            )
            byDay.getOrPut(dayKey) { mutableListOf() }.add(network)
            imported++
        }

        val records = byDay.map { (dayMs, nets) -> ScanRecord(dayMs, nets) }
            .sortedByDescending { it.timestampMs }

        return WigleImportResult(records, imported, skipped)
    }

    // ── helpers ───────────────────────────────────────────────────────────

    /** RFC 4180 CSV tokeniser that handles quoted fields with embedded commas. */
    internal fun tokenise(line: String): List<String> {
        val result = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuotes = false
        var i = 0
        while (i < line.length) {
            val c = line[i]
            when {
                c == '"' && !inQuotes -> inQuotes = true
                c == '"' && inQuotes  -> {
                    if (i + 1 < line.length && line[i + 1] == '"') {
                        // escaped quote inside field
                        sb.append('"'); i++
                    } else {
                        inQuotes = false
                    }
                }
                c == ',' && !inQuotes -> { result.add(sb.toString()); sb.clear() }
                else -> sb.append(c)
            }
            i++
        }
        result.add(sb.toString())
        return result
    }

    private fun parseDate(s: String): Long? {
        if (s.isBlank()) return null
        for (fmt in DATE_FORMATS) {
            try { return fmt.parse(s)?.time } catch (_: Exception) {}
        }
        return null
    }

    /** Truncate a timestamp to the start of its UTC calendar day. */
    private fun utcDayKey(epochMs: Long): Long = utcDayBucketMs(epochMs)

    /**
     * Convert a WiGLE channel number to a centre frequency in MHz.
     * Mirrors [WifiDisplayUtils.frequencyToChannel] in reverse.
     */
    internal fun channelToFreq(channel: Int): Int = when {
        channel == 14                -> 2484
        channel in 1..13             -> 2407 + channel * 5
        channel in 36..177           -> 5000 + channel * 5
        channel > 177                -> 5950 + channel * 5   // 6 GHz (Wi-Fi 6E/7)
        else                         -> 2412
    }
}
