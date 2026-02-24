package com.wifisentry.core

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File

/**
 * Lightweight JSON-file-backed persistence for scan history.
 *
 * Keeps at most [maxRecords] scan records on disk; older records are dropped
 * when the limit is exceeded.
 *
 * The primary constructor accepts a [File] directly, which makes the class
 * fully testable without a real [Context].  The secondary constructor is the
 * normal production entry-point.
 */
class ScanStorage(private val file: File, private val maxRecords: Int = MAX_RECORDS) {

    constructor(context: Context, maxRecords: Int = MAX_RECORDS) :
            this(File(context.filesDir, FILE_NAME), maxRecords)

    private val gson = Gson()

    /** Load the persisted scan history, newest first. */
    fun loadHistory(): List<ScanRecord> {
        if (!file.exists()) return emptyList()
        return try {
            val json = file.readText()
            val type = object : TypeToken<List<ScanRecordDto>>() {}.type
            val dtos: List<ScanRecordDto> = gson.fromJson(json, type) ?: emptyList()
            dtos.map { it.toModel() }.sortedByDescending { it.timestampMs }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** Append a new scan record and trim the list if needed. */
    fun appendRecord(record: ScanRecord) {
        val existing = loadHistory().toMutableList()
        existing.add(0, record)
        val trimmed = if (existing.size > maxRecords) existing.take(maxRecords) else existing
        val dtos = trimmed.map { ScanRecordDto.fromModel(it) }
        file.writeText(gson.toJson(dtos))
    }

    /** Remove all stored history. */
    fun clearHistory() {
        if (file.exists()) file.delete()
    }

    // ── DTO classes (safe for Gson serialisation) ─────────────────────────

    private data class NetworkDto(
        val ssid: String,
        val bssid: String,
        val capabilities: String,
        val rssi: Int,
        val frequency: Int,
        val timestamp: Long,
        val threats: List<String>,
        // GPS fields — null when no fix available so Gson serialises clean JSON (NaN is non-standard).
        val latitude: Double? = null,
        val longitude: Double? = null,
        val altitude: Double? = null,
        val gpsAccuracy: Float? = null,
    ) {
        fun toModel() = ScannedNetwork(
            ssid = ssid,
            bssid = bssid,
            capabilities = capabilities,
            rssi = rssi,
            frequency = frequency,
            timestamp = timestamp,
            threats = threats.mapNotNull { runCatching { ThreatType.valueOf(it) }.getOrNull() },
            latitude = latitude ?: Double.NaN,
            longitude = longitude ?: Double.NaN,
            altitude = altitude ?: Double.NaN,
            gpsAccuracy = gpsAccuracy ?: Float.NaN,
        )

        companion object {
            fun fromModel(n: ScannedNetwork) = NetworkDto(
                ssid = n.ssid,
                bssid = n.bssid,
                capabilities = n.capabilities,
                rssi = n.rssi,
                frequency = n.frequency,
                timestamp = n.timestamp,
                threats = n.threats.map { it.name },
                latitude = if (n.latitude.isFinite()) n.latitude else null,
                longitude = if (n.longitude.isFinite()) n.longitude else null,
                altitude = if (n.altitude.isFinite()) n.altitude else null,
                gpsAccuracy = if (n.gpsAccuracy.isFinite()) n.gpsAccuracy else null,
            )
        }
    }

    private data class ScanRecordDto(
        val timestampMs: Long,
        val networks: List<NetworkDto>
    ) {
        fun toModel() = ScanRecord(
            timestampMs = timestampMs,
            networks = networks.map { it.toModel() }
        )

        companion object {
            fun fromModel(r: ScanRecord) = ScanRecordDto(
                timestampMs = r.timestampMs,
                networks = r.networks.map { NetworkDto.fromModel(it) }
            )
        }
    }

    companion object {
        private const val FILE_NAME = "scan_history.json"
        private const val MAX_RECORDS = 50
    }
}
