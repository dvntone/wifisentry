package com.wifisentry.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

class ScanStorageTest {

    private lateinit var tempFile: File
    private lateinit var storage: ScanStorage

    @Before
    fun setUp() {
        // Create a temp file path that does NOT yet exist so ScanStorage starts clean.
        tempFile = File.createTempFile("scan_storage_test", ".json")
        tempFile.delete()
        storage = ScanStorage(tempFile)
    }

    @After
    fun tearDown() {
        tempFile.delete()
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private fun makeRecord(timestampMs: Long, networkCount: Int = 1): ScanRecord {
        val networks = (1..networkCount).map { i ->
            ScannedNetwork(
                ssid = "Net$i",
                bssid = "AA:BB:CC:DD:EE:0$i",
                capabilities = "[WPA2-PSK-CCMP][ESS]",
                rssi = -60,
                frequency = 2412,
                timestamp = timestampMs
            )
        }
        return ScanRecord(timestampMs = timestampMs, networks = networks)
    }

    // ── loadHistory ───────────────────────────────────────────────────────

    @Test
    fun `loadHistory returns empty list when file does not exist`() {
        assertFalse(tempFile.exists())
        assertTrue(storage.loadHistory().isEmpty())
    }

    @Test
    fun `loadHistory returns empty list for corrupt file content`() {
        tempFile.writeText("not valid json {{{{")
        assertTrue(storage.loadHistory().isEmpty())
    }

    // ── appendRecord / loadHistory round-trip ─────────────────────────────

    @Test
    fun `appendRecord persists and loadHistory retrieves the record`() {
        val record = makeRecord(1_000L)
        storage.appendRecord(record)

        val history = storage.loadHistory()
        assertEquals(1, history.size)
        assertEquals(record.timestampMs, history.first().timestampMs)
        assertEquals(record.networks.size, history.first().networks.size)
        assertEquals(record.networks.first().ssid, history.first().networks.first().ssid)
    }

    @Test
    fun `appendRecord preserves threat types through serialization`() {
        val network = ScannedNetwork(
            ssid = "BadNet",
            bssid = "11:22:33:44:55:66",
            capabilities = "[ESS]",
            rssi = -70,
            frequency = 5180,
            timestamp = 2_000L,
            threats = listOf(ThreatType.OPEN_NETWORK, ThreatType.SUSPICIOUS_SSID)
        )
        storage.appendRecord(ScanRecord(timestampMs = 2_000L, networks = listOf(network)))

        val loaded = storage.loadHistory().first().networks.first()
        assertEquals(listOf(ThreatType.OPEN_NETWORK, ThreatType.SUSPICIOUS_SSID), loaded.threats)
    }

    // ── ordering ──────────────────────────────────────────────────────────

    @Test
    fun `loadHistory returns records sorted newest first`() {
        val older = makeRecord(1_000L)
        val newer = makeRecord(9_000L)
        storage.appendRecord(older)
        storage.appendRecord(newer)

        val history = storage.loadHistory()
        assertEquals(2, history.size)
        assertTrue("Newest record should be first", history[0].timestampMs > history[1].timestampMs)
    }

    // ── trim ──────────────────────────────────────────────────────────────

    @Test
    fun `appendRecord trims history to maxRecords`() {
        val maxRecords = 3
        val limitedStorage = ScanStorage(tempFile, maxRecords)
        for (i in 1..5) {
            limitedStorage.appendRecord(makeRecord(i * 1_000L))
        }

        val history = limitedStorage.loadHistory()
        assertEquals(maxRecords, history.size)
        // The three most recent records (timestamps 3000, 4000, 5000) should be kept.
        val timestamps = history.map { it.timestampMs }.sorted()
        assertEquals(listOf(3_000L, 4_000L, 5_000L), timestamps)
    }

    // ── clearHistory ──────────────────────────────────────────────────────

    @Test
    fun `clearHistory removes all stored records`() {
        storage.appendRecord(makeRecord(1_000L))
        assertTrue(tempFile.exists())

        storage.clearHistory()

        assertFalse(tempFile.exists())
        assertTrue(storage.loadHistory().isEmpty())
    }

    @Test
    fun `clearHistory is safe when no file exists`() {
        assertFalse(tempFile.exists())
        storage.clearHistory() // must not throw
    }
}
