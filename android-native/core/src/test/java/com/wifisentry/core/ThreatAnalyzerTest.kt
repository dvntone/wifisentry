package com.wifisentry.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ThreatAnalyzerTest {

    private lateinit var analyzer: ThreatAnalyzer

    @Before
    fun setUp() {
        analyzer = ThreatAnalyzer(
            suspiciousKeywords = listOf("free", "evil", "guest"),
            recentWindowMs = 10 * 60 * 1000L
        )
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private fun network(
        ssid: String = "TestNetwork",
        bssid: String = "AA:BB:CC:DD:EE:FF",
        capabilities: String = "[WPA2-PSK-CCMP][ESS]",
        threats: List<ThreatType> = emptyList()
    ) = ScannedNetwork(
        ssid = ssid,
        bssid = bssid,
        capabilities = capabilities,
        rssi = -60,
        frequency = 2412,
        timestamp = System.currentTimeMillis(),
        threats = threats
    )

    // ── OPEN_NETWORK ───────────────────────────────────────────────────────

    @Test
    fun `open network flagged when no WPA or WEP`() {
        val result = analyzer.analyze(listOf(network(capabilities = "[ESS]")), emptyList())
        assertTrue(result.first().threats.contains(ThreatType.OPEN_NETWORK))
    }

    @Test
    fun `WPA network not flagged as open`() {
        val result = analyzer.analyze(listOf(network(capabilities = "[WPA2-PSK-CCMP][ESS]")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.OPEN_NETWORK))
    }

    @Test
    fun `SAE (WPA3) network not flagged as open`() {
        val result = analyzer.analyze(listOf(network(capabilities = "[SAE][ESS]")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.OPEN_NETWORK))
    }

    @Test
    fun `WEP network not flagged as open`() {
        val result = analyzer.analyze(listOf(network(capabilities = "[WEP][ESS]")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.OPEN_NETWORK))
    }

    // ── SUSPICIOUS_SSID ────────────────────────────────────────────────────

    @Test
    fun `SSID with suspicious keyword flagged`() {
        val result = analyzer.analyze(listOf(network(ssid = "FreeWifi")), emptyList())
        assertTrue(result.first().threats.contains(ThreatType.SUSPICIOUS_SSID))
    }

    @Test
    fun `SSID keyword match is case-insensitive`() {
        val result = analyzer.analyze(listOf(network(ssid = "EVIL_TWIN")), emptyList())
        assertTrue(result.first().threats.contains(ThreatType.SUSPICIOUS_SSID))
    }

    @Test
    fun `normal SSID not flagged as suspicious`() {
        val result = analyzer.analyze(listOf(network(ssid = "HomeNetwork")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.SUSPICIOUS_SSID))
    }

    // ── MULTIPLE_BSSIDS ────────────────────────────────────────────────────

    @Test
    fun `same SSID with two different BSSIDs in current scan flagged`() {
        val networks = listOf(
            network(ssid = "SharedSSID", bssid = "AA:BB:CC:00:00:01"),
            network(ssid = "SharedSSID", bssid = "AA:BB:CC:00:00:02")
        )
        val result = analyzer.analyze(networks, emptyList())
        assertTrue(result.all { it.threats.contains(ThreatType.MULTIPLE_BSSIDS) })
    }

    @Test
    fun `same SSID with one BSSID not flagged for multiple BSSIDs`() {
        val result = analyzer.analyze(
            listOf(network(ssid = "UniqueNet", bssid = "AA:BB:CC:00:00:01")),
            emptyList()
        )
        assertFalse(result.first().threats.contains(ThreatType.MULTIPLE_BSSIDS))
    }

    @Test
    fun `same SSID seen with different BSSID in recent history flagged`() {
        val historicNetwork = network(ssid = "CafeNet", bssid = "11:22:33:44:55:66")
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(historicNetwork)))

        val currentNetwork = network(ssid = "CafeNet", bssid = "AA:BB:CC:DD:EE:FF")
        val result = analyzer.analyze(listOf(currentNetwork), history)

        assertTrue(result.first().threats.contains(ThreatType.MULTIPLE_BSSIDS))
    }

    @Test
    fun `same SSID seen with different BSSID outside history window not flagged`() {
        val oldBssid = "11:22:33:44:55:66"
        // Record is older than the 10-minute window
        val historicNetwork = network(ssid = "CafeNet", bssid = oldBssid)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 11 * 60 * 1000L, listOf(historicNetwork)))

        val currentNetwork = network(ssid = "CafeNet", bssid = "AA:BB:CC:DD:EE:FF")
        val result = analyzer.analyze(listOf(currentNetwork), history)

        assertFalse(result.first().threats.contains(ThreatType.MULTIPLE_BSSIDS))
    }

    @Test
    fun `same SSID seen with same BSSID in history not flagged for multiple BSSIDs`() {
        val bssid = "AA:BB:CC:DD:EE:FF"
        val historicNetwork = network(ssid = "StableNet", bssid = bssid)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(historicNetwork)))

        val result = analyzer.analyze(listOf(network(ssid = "StableNet", bssid = bssid)), history)
        assertFalse(result.first().threats.contains(ThreatType.MULTIPLE_BSSIDS))
    }

    // ── SECURITY_CHANGE ────────────────────────────────────────────────────

    @Test
    fun `security downgrade from WPA2 to open flagged`() {
        val oldNetwork = network(ssid = "CorpNet", capabilities = "[WPA2-PSK-CCMP][ESS]")
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(oldNetwork)))

        val current = network(ssid = "CorpNet", capabilities = "[ESS]")
        val result = analyzer.analyze(listOf(current), history)

        assertTrue(result.first().threats.contains(ThreatType.SECURITY_CHANGE))
    }

    @Test
    fun `security change not triggered when only WPS tag is removed`() {
        val oldNetwork = network(ssid = "HomeNet", capabilities = "[WPA2-PSK-CCMP][ESS][WPS]")
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(oldNetwork)))

        val current = network(ssid = "HomeNet", capabilities = "[WPA2-PSK-CCMP][ESS]")
        val result = analyzer.analyze(listOf(current), history)

        assertFalse(result.first().threats.contains(ThreatType.SECURITY_CHANGE))
    }

    @Test
    fun `stable security not flagged for security change`() {
        val caps = "[WPA2-PSK-CCMP][ESS]"
        val oldNetwork = network(ssid = "StableNet", capabilities = caps)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(oldNetwork)))

        val result = analyzer.analyze(listOf(network(ssid = "StableNet", capabilities = caps)), history)
        assertFalse(result.first().threats.contains(ThreatType.SECURITY_CHANGE))
    }

    @Test
    fun `new network with no history not flagged for security change`() {
        val result = analyzer.analyze(
            listOf(network(ssid = "BrandNew", capabilities = "[WPA2-PSK-CCMP][ESS]")),
            emptyList()
        )
        assertFalse(result.first().threats.contains(ThreatType.SECURITY_CHANGE))
    }

    // ── isFlagged / isOpen convenience ─────────────────────────────────────

    @Test
    fun `isFlagged true when threats non-empty`() {
        val n = network(capabilities = "[ESS]")  // open
        val result = analyzer.analyze(listOf(n), emptyList())
        assertTrue(result.first().isFlagged)
    }

    @Test
    fun `isOpen true for open network`() {
        assertTrue(network(capabilities = "[ESS]").isOpen)
    }

    @Test
    fun `isOpen false for SAE (WPA3) network`() {
        assertFalse(network(capabilities = "[SAE][ESS]").isOpen)
    }

    @Test
    fun `isOpen false for WPA network`() {
        assertFalse(network(capabilities = "[WPA2-PSK-CCMP][ESS]").isOpen)
    }
}
