package com.wifisentry.core

import org.junit.Assert.*
import org.junit.Test

class ChangeAnalyzerTest {

    private fun net(
        ssid: String = "TestNet",
        bssid: String = "AA:BB:CC:DD:EE:FF",
        capabilities: String = "[WPA2-PSK-CCMP][RSN][ESS]",
        rssi: Int = -65,
        frequency: Int = 2437, // ch6
        lat: Double = Double.NaN,
        lon: Double = Double.NaN,
    ) = ScannedNetwork(ssid, bssid, capabilities, rssi, frequency, System.currentTimeMillis(),
        latitude = lat, longitude = lon)

    private fun record(vararg networks: ScannedNetwork, tsOffset: Long = 0L) =
        ScanRecord(System.currentTimeMillis() - tsOffset, networks.toList())

    // ── Fewer than 2 records returns no results ────────────────────────────

    @Test fun `empty records list returns empty result`() {
        val result = ChangeAnalyzer.analyze(emptyList())
        assertEquals(0, result.changeCount)
    }

    @Test fun `single record returns empty result`() {
        val result = ChangeAnalyzer.analyze(listOf(record(net())))
        assertEquals(0, result.changeCount)
    }

    // ── Security downgrade ─────────────────────────────────────────────────

    @Test fun `WPA2 to Open triggers SECURITY_DOWNGRADE`() {
        val old    = record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"), tsOffset = 10_000)
        val newest = record(net(capabilities = "[ESS]"))
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertTrue(result.changes.any { it.type == ChangeType.SECURITY_DOWNGRADE })
    }

    @Test fun `WPA to WPA2 triggers SECURITY_UPGRADE not DOWNGRADE`() {
        val old    = record(net(capabilities = "[WPA-PSK-TKIP][ESS]"), tsOffset = 10_000)
        val newest = record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"))
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertTrue(result.changes.any  { it.type == ChangeType.SECURITY_UPGRADE   })
        assertFalse(result.changes.any { it.type == ChangeType.SECURITY_DOWNGRADE })
    }

    @Test fun `same security produces no security change`() {
        val old    = record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"), tsOffset = 10_000)
        val newest = record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"))
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertFalse(result.changes.any { it.type == ChangeType.SECURITY_DOWNGRADE })
        assertFalse(result.changes.any { it.type == ChangeType.SECURITY_UPGRADE   })
    }

    // ── Channel shift ──────────────────────────────────────────────────────

    @Test fun `channel change triggers CHANNEL_SHIFT`() {
        val old    = record(net(frequency = 2437), tsOffset = 10_000) // ch6 2.4G
        val newest = record(net(frequency = 5180))                    // ch36 5G
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertTrue(result.changes.any { it.type == ChangeType.CHANNEL_SHIFT })
    }

    @Test fun `same channel produces no channel shift`() {
        val old    = record(net(frequency = 2437), tsOffset = 10_000)
        val newest = record(net(frequency = 2437))
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertFalse(result.changes.any { it.type == ChangeType.CHANNEL_SHIFT })
    }

    // ── Signal anomaly ─────────────────────────────────────────────────────

    @Test fun `large RSSI drop triggers SIGNAL_ANOMALY`() {
        val old    = record(net(rssi = -50), tsOffset = 10_000)
        val newest = record(net(rssi = -85))  // 35 dBm drop
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertTrue(result.changes.any { it.type == ChangeType.SIGNAL_ANOMALY })
    }

    @Test fun `small RSSI change within normal variance produces no anomaly`() {
        val old    = record(net(rssi = -65), tsOffset = 10_000)
        val newest = record(net(rssi = -68))  // only 3 dBm
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        assertFalse(result.changes.any { it.type == ChangeType.SIGNAL_ANOMALY })
    }

    // ── New BSSID on known SSID ────────────────────────────────────────────

    @Test fun `new unknown BSSID on known SSID triggers NEW_BSSID_SAME_SSID`() {
        val old1   = record(net(ssid = "HomeWifi", bssid = "AA:BB:CC:DD:EE:FF"), tsOffset = 20_000)
        val old2   = record(net(ssid = "HomeWifi", bssid = "AA:BB:CC:DD:EE:FF"), tsOffset = 10_000)
        val newest = record(net(ssid = "HomeWifi", bssid = "11:22:33:44:55:66"))
        val result = ChangeAnalyzer.analyze(listOf(newest, old2, old1))
        assertTrue(result.changes.any { it.type == ChangeType.NEW_BSSID_SAME_SSID })
    }

    // ── Score and severity ─────────────────────────────────────────────────

    @Test fun `security downgrade score is HIGH severity`() {
        val old    = record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"), tsOffset = 10_000)
        val newest = record(net(capabilities = "[ESS]"))
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        val downgrade = result.changes.first { it.type == ChangeType.SECURITY_DOWNGRADE }
        assertEquals(ThreatSeverity.HIGH, downgrade.severity)
    }

    @Test fun `score is in 0-100 range`() {
        val old    = record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"), tsOffset = 10_000)
        val newest = record(net(capabilities = "[ESS]"))
        val result = ChangeAnalyzer.analyze(listOf(newest, old))
        result.changes.forEach { change ->
            assertTrue("Score ${change.score} out of range", change.score in 0..100)
        }
    }

    // ── Analyse convenience overload ───────────────────────────────────────

    @Test fun `analyze(current, history) convenience overload works`() {
        val history = listOf(
            record(net(capabilities = "[WPA2-PSK-CCMP][RSN][ESS]"), tsOffset = 10_000)
        )
        val current = listOf(net(capabilities = "[ESS]"))
        val result = ChangeAnalyzer.analyze(current, history)
        assertTrue(result.changes.any { it.type == ChangeType.SECURITY_DOWNGRADE })
    }
}
