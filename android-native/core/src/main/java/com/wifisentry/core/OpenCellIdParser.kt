package com.wifisentry.core

/**
 * Parses an OpenCellID / Mozilla Location Service CSV export into a list of
 * [CellTowerRecord]s.
 *
 * The OpenCellID CSV format has a single header line followed by data rows:
 * ```
 * radio,mcc,mnc,lac,cid,lon,lat,range,samples,changeable,created,updated,averageSignal
 * GSM,310,410,12345,67890,-87.6298,41.8781,1000,10,1,1609459200,1609459200,-85
 * ```
 * All numeric fields are validated; rows with missing or non-numeric required
 * fields are silently skipped.
 */
object OpenCellIdParser {

    data class OpenCellIdImportResult(
        val towers: List<CellTowerRecord>,
        val importedTowers: Int,
        val skippedRows: Int,
    )

    /** Parse [csv] text and return validated cell tower records. */
    fun parse(csv: String): OpenCellIdImportResult {
        val lines = csv.lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toList()

        if (lines.isEmpty()) return OpenCellIdImportResult(emptyList(), 0, 0)

        // Locate the header row
        var headerIndex = -1
        for (i in lines.indices) {
            if (lines[i].startsWith("radio,", ignoreCase = true)) {
                headerIndex = i
                break
            }
        }
        if (headerIndex < 0) return OpenCellIdImportResult(emptyList(), 0, lines.size)

        val headers = lines[headerIndex].split(",").map { it.lowercase().trim() }
        val colRadio   = headers.indexOf("radio")
        val colMcc     = headers.indexOf("mcc")
        val colMnc     = headers.indexOf("mnc")
        val colLac     = headers.indexOf("lac")
        val colCid     = headers.indexOf("cid")
        val colLon     = headers.indexOf("lon")
        val colLat     = headers.indexOf("lat")
        val colRange   = headers.indexOf("range")
        val colSamples = headers.indexOf("samples")
        val colAvgSig  = headers.indexOf("averagesignal")

        if (colRadio < 0 || colMcc < 0 || colMnc < 0 || colLac < 0 || colCid < 0 ||
            colLon < 0 || colLat < 0) {
            return OpenCellIdImportResult(emptyList(), 0, lines.size)
        }

        val towers  = mutableListOf<CellTowerRecord>()
        var skipped = 0

        for (i in (headerIndex + 1) until lines.size) {
            val cols = lines[i].split(",")
            if (cols.size < 7) { skipped++; continue }

            val radio   = cols.getOrNull(colRadio)?.trim()?.uppercase() ?: ""
            val mcc     = cols.getOrNull(colMcc)?.trim()?.toIntOrNull()
            val mnc     = cols.getOrNull(colMnc)?.trim()?.toIntOrNull()
            val lac     = cols.getOrNull(colLac)?.trim()?.toIntOrNull()
            val cid     = cols.getOrNull(colCid)?.trim()?.toLongOrNull()?.toInt()
            val lon     = cols.getOrNull(colLon)?.trim()?.toDoubleOrNull()
            val lat     = cols.getOrNull(colLat)?.trim()?.toDoubleOrNull()
            val range   = cols.getOrNull(colRange)?.trim()?.toIntOrNull() ?: 0
            val samples = cols.getOrNull(colSamples)?.trim()?.toIntOrNull() ?: 0
            val avgSig  = if (colAvgSig >= 0) cols.getOrNull(colAvgSig)?.trim()?.toIntOrNull() ?: 0 else 0

            // Validate required fields
            if (mcc == null || mnc == null || lac == null || cid == null ||
                lon == null || lat == null) {
                skipped++; continue
            }
            if (!lon.isFinite() || !lat.isFinite()) { skipped++; continue }

            towers.add(CellTowerRecord(
                radio         = radio,
                mcc           = mcc,
                mnc           = mnc,
                lac           = lac,
                cid           = cid,
                lon           = lon,
                lat           = lat,
                rangeMeters   = range,
                samples       = samples,
                averageSignal = avgSig,
            ))
        }

        return OpenCellIdImportResult(towers, towers.size, skipped)
    }
}
