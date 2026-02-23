package com.wifisentry.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files

class ScanStorageTest {

    private lateinit var tempDir: File
    private lateinit var storage: ScanStorage

    @Before
    fun setUp() {
        tempDir = Files.createTempDirectory("scan_storage_test").toFile()
        storage = ScanStorage(tempDir)
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private fun network(ssid: String = "TestNet", bssid: String = "AA:BB:CC:DD:EE:FF") =
        ScannedNetwork(
            ssid = ssid,
            bssid = bssid,
            capabilities = "[WPA2-PSK-CCMP][ESS]",
            rssi = -55,
            frequency = 2412,
            timestamp = System.currentTimeMillis()
        )

    private fun record(networks: List<ScannedNetwork> = listOf(network())) =
        ScanRecord(timestampMs = System.currentTimeMillis(), networks = networks)

    // ── loadHistory ────────────────────────────────────────────────────────

    @Test
    fun `loadHistory returns empty list when no file exists`() {
        assertTrue(storage.loadHistory().isEmpty())
    }

    @Test
    fun `loadHistory returns previously stored records`() {
        val rec = record()
        storage.appendRecord(rec)

        val history = storage.loadHistory()
        assertEquals(1, history.size)
        assertEquals(rec.networks.first().ssid, history.first().networks.first().ssid)
    }

    // ── appendRecord ───────────────────────────────────────────────────────

    @Test
    fun `appendRecord accumulates multiple records`() {
        storage.appendRecord(record(listOf(network(ssid = "Net1"))))
        storage.appendRecord(record(listOf(network(ssid = "Net2"))))
        storage.appendRecord(record(listOf(network(ssid = "Net3"))))

        assertEquals(3, storage.loadHistory().size)
    }

    @Test
    fun `appendRecord preserves threat types through serialisation`() {
        val flagged = network().copy(threats = listOf(ThreatType.OPEN_NETWORK, ThreatType.SUSPICIOUS_SSID))
        storage.appendRecord(record(listOf(flagged)))

        val loaded = storage.loadHistory().first().networks.first()
        assertEquals(listOf(ThreatType.OPEN_NETWORK, ThreatType.SUSPICIOUS_SSID), loaded.threats)
    }

    @Test
    fun `appendRecord trims to maxRecords when limit exceeded`() {
        val limitedStorage = ScanStorage(tempDir, maxRecords = 3)
        repeat(5) { limitedStorage.appendRecord(record()) }

        assertEquals(3, limitedStorage.loadHistory().size)
    }

    // ── clearHistory ───────────────────────────────────────────────────────

    @Test
    fun `clearHistory removes all stored records`() {
        storage.appendRecord(record())
        storage.appendRecord(record())

        storage.clearHistory()

        assertTrue(storage.loadHistory().isEmpty())
    }

    @Test
    fun `clearHistory is safe when no history exists`() {
        storage.clearHistory() // Should not throw
        assertTrue(storage.loadHistory().isEmpty())
    }
}
