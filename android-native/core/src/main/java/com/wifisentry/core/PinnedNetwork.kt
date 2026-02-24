package com.wifisentry.core

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File

/**
 * A network the user has manually pinned for long-term tracking.
 *
 * Pinned networks are persisted across app restarts and are shown in
 * [PinDetailActivity] where the full per-BSSID scan history, ChangeAnalyzer
 * output, and optional Gemini AI analysis are displayed.
 */
data class PinnedNetwork(
    val bssid: String,
    val ssid: String,
    val pinnedAtMs: Long = System.currentTimeMillis(),
    /** Optional user note attached to this pin. */
    val note: String = "",
)

/**
 * Lightweight JSON-file-backed persistence for [PinnedNetwork] entries.
 *
 * Stored in the app's private files directory — never accessible to other apps.
 */
class PinnedStorage(private val file: File) {

    constructor(context: Context) : this(File(context.filesDir, FILE_NAME))

    private val gson = Gson()

    /** Load all pinned networks, newest-pin first. */
    fun loadPinned(): List<PinnedNetwork> {
        if (!file.exists()) return emptyList()
        return try {
            val type = object : TypeToken<List<PinnedNetwork>>() {}.type
            gson.fromJson<List<PinnedNetwork>>(file.readText(), type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Pin [network], replacing any existing entry with the same BSSID.
     * Returns true if this is a new pin, false if it replaced an existing one.
     */
    fun pin(network: PinnedNetwork): Boolean {
        val existing = loadPinned().toMutableList()
        val idx = existing.indexOfFirst { it.bssid == network.bssid }
        val isNew = idx < 0
        if (isNew) existing.add(0, network) else existing[idx] = network
        save(existing)
        return isNew
    }

    /** Remove the pin for [bssid].  No-op if not pinned. */
    fun unpin(bssid: String) {
        val updated = loadPinned().filter { it.bssid != bssid }
        save(updated)
    }

    /** True when [bssid] is currently pinned. */
    fun isPinned(bssid: String): Boolean = loadPinned().any { it.bssid == bssid }

    /** Remove all pins. */
    fun clearAll() {
        if (file.exists()) file.delete()
    }

    private fun save(pins: List<PinnedNetwork>) {
        file.writeText(gson.toJson(pins))
    }

    companion object {
        private const val FILE_NAME = "pinned_networks.json"
    }
}
