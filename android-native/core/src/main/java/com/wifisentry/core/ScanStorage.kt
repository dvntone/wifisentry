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
 * @param storageDir Directory in which the history file is stored.
 * @param maxRecords Maximum number of scan records to retain.
 */
class ScanStorage(storageDir: File, private val maxRecords: Int = MAX_RECORDS) {

    /** Convenience constructor that uses [Context.getFilesDir] as the storage directory. */
    constructor(context: Context, maxRecords: Int = MAX_RECORDS) :
            this(context.filesDir, maxRecords)

    private val file: File = File(storageDir, FILE_NAME)
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
        val threats: List<String>
    ) {
        fun toModel() = ScannedNetwork(
            ssid = ssid,
            bssid = bssid,
            capabilities = capabilities,
            rssi = rssi,
            frequency = frequency,
            timestamp = timestamp,
            threats = threats.mapNotNull { runCatching { ThreatType.valueOf(it) }.getOrNull() }
        )

        companion object {
            fun fromModel(n: ScannedNetwork) = NetworkDto(
                ssid = n.ssid,
                bssid = n.bssid,
                capabilities = n.capabilities,
                rssi = n.rssi,
                frequency = n.frequency,
                timestamp = n.timestamp,
                threats = n.threats.map { it.name }
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
