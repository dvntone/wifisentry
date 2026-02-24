package com.wifisentry.core

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File

/**
 * JSON-backed storage for [CellTowerRecord] entries imported from OpenCellID /
 * Mozilla Location Service CSV exports.
 *
 * Deduplication key: `radio:mcc:mnc:lac:cid` — the five-tuple that uniquely
 * identifies a cell tower in the OpenCellID database.
 *
 * Capacity is capped at [maxTowers] entries (default 5 000) to bound storage.
 */
class CellTowerStorage(private val file: File, private val maxTowers: Int = MAX_TOWERS) {

    constructor(context: Context, maxTowers: Int = MAX_TOWERS) :
            this(File(context.filesDir, FILE_NAME), maxTowers)

    private val gson = Gson()

    /** Load all stored towers. */
    fun loadTowers(): List<CellTowerRecord> {
        if (!file.exists()) return emptyList()
        return try {
            val type = object : TypeToken<List<CellTowerRecord>>() {}.type
            gson.fromJson<List<CellTowerRecord>>(file.readText(), type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Merge [incoming] towers into the stored set, deduplicating by the
     * five-tuple key.  Existing entries are not overwritten (import is additive).
     * Trims to [maxTowers] when capacity is exceeded.
     *
     * @return the number of new towers actually added.
     */
    fun importTowers(incoming: List<CellTowerRecord>): Int {
        val existing   = loadTowers().associateByTo(LinkedHashMap(), ::towerKey)
        val beforeSize = existing.size
        for (tower in incoming) {
            val key = towerKey(tower)
            if (key !in existing) existing[key] = tower
        }
        val merged = existing.values.toList().let {
            if (it.size > maxTowers) it.takeLast(maxTowers) else it
        }
        file.writeText(gson.toJson(merged))
        return merged.size - beforeSize.coerceAtMost(merged.size)
    }

    /** Find the best-matching tower for a given cell identity. */
    fun findNearest(radio: String, mcc: Int, mnc: Int, lac: Int, cid: Int): CellTowerRecord? =
        loadTowers().firstOrNull { t ->
            t.radio.equals(radio, ignoreCase = true) &&
                    t.mcc == mcc && t.mnc == mnc && t.lac == lac && t.cid == cid
        }

    /** Remove all stored cell towers. */
    fun clearTowers() {
        if (file.exists()) file.delete()
    }

    private fun towerKey(t: CellTowerRecord) =
        "${t.radio.uppercase()}:${t.mcc}:${t.mnc}:${t.lac}:${t.cid}"

    companion object {
        private const val FILE_NAME  = "cell_towers.json"
        private const val MAX_TOWERS = 5_000
    }
}
