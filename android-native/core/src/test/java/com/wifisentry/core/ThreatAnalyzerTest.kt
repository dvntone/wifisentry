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
        bssid: String = "00:11:22:33:44:55",  // globally-administered by default
        capabilities: String = "[WPA2-PSK-CCMP][ESS]",
        rssi: Int = -60,
        frequency: Int = 2412,                // 2.4 GHz by default
        wifiStandard: Int = WIFI_STANDARD_UNKNOWN,
        threats: List<ThreatType> = emptyList()
    ) = ScannedNetwork(
        ssid = ssid,
        bssid = bssid,
        capabilities = capabilities,
        rssi = rssi,
        frequency = frequency,
        timestamp = System.currentTimeMillis(),
        wifiStandard = wifiStandard,
        threats = threats
    )

    private fun recentHistory(vararg networks: ScannedNetwork): List<ScanRecord> =
        listOf(ScanRecord(System.currentTimeMillis() - RECENT_MS, networks.toList()))

    companion object {
        /** A history timestamp safely inside the 10-minute recent window. */
        private const val RECENT_MS = 60_000L
    }

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
    fun `SSID containing 'test' substring not flagged as suspicious (keyword removed)`() {
        val result = analyzer.analyze(listOf(network(ssid = "TestNetwork")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.SUSPICIOUS_SSID))
    }

    @Test
    fun `SSID containing 'probe' substring not flagged as suspicious (keyword removed)`() {
        val result = analyzer.analyze(listOf(network(ssid = "ProbeStreetWifi")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.SUSPICIOUS_SSID))
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

    // ── EVIL_TWIN ─────────────────────────────────────────────────────────

    @Test
    fun `open AP matching historically secured SSID with new BSSID flagged as evil twin`() {
        val historic = network(ssid = "CoffeeShop", bssid = "00:11:22:33:44:55", capabilities = "[WPA2-PSK-CCMP][ESS]")
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(historic)))

        val current = network(ssid = "CoffeeShop", bssid = "00:AA:BB:CC:DD:11", capabilities = "[ESS]")
        val result = analyzer.analyze(listOf(current), history)

        assertTrue(result.first().threats.contains(ThreatType.EVIL_TWIN))
    }

    @Test
    fun `open AP matching historically secured SSID with same BSSID not flagged as evil twin`() {
        val bssid = "00:11:22:33:44:55"
        val historic = network(ssid = "CoffeeShop", bssid = bssid, capabilities = "[WPA2-PSK-CCMP][ESS]")
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(historic)))

        // Same physical AP downgraded its own security — SECURITY_CHANGE, not EVIL_TWIN
        val current = network(ssid = "CoffeeShop", bssid = bssid, capabilities = "[ESS]")
        val result = analyzer.analyze(listOf(current), history)

        assertFalse(result.first().threats.contains(ThreatType.EVIL_TWIN))
    }

    @Test
    fun `open AP with no matching history not flagged as evil twin`() {
        val result = analyzer.analyze(
            listOf(network(ssid = "NewCafe", capabilities = "[ESS]")),
            emptyList()
        )
        assertFalse(result.first().threats.contains(ThreatType.EVIL_TWIN))
    }

    @Test
    fun `secured AP with new BSSID not flagged as evil twin`() {
        val historic = network(ssid = "CorpNet", bssid = "00:11:22:33:44:55", capabilities = "[WPA2-PSK-CCMP][ESS]")
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(historic)))

        val current = network(ssid = "CorpNet", bssid = "00:AA:BB:CC:DD:11", capabilities = "[WPA2-PSK-CCMP][ESS]")
        val result = analyzer.analyze(listOf(current), history)

        assertFalse(result.first().threats.contains(ThreatType.EVIL_TWIN))
    }

    // ── MAC_SPOOFING_SUSPECTED ────────────────────────────────────────────

    @Test
    fun `locally-administered BSSID not in history flagged as suspected MAC spoofing`() {
        // No prior history — brand-new LA BSSID (e.g. fresh Marauder/Pineapple AP) must be flagged.
        val result = analyzer.analyze(listOf(network(bssid = "02:00:00:00:00:01")), emptyList())
        assertTrue(result.first().threats.contains(ThreatType.MAC_SPOOFING_SUSPECTED))
    }

    @Test
    fun `locally-administered BSSID already in history NOT flagged (stable enterprise AP)`() {
        // LA BSSID present in prior scan → Cisco/Aruba enterprise controller; suppress false positive.
        val bssid = "02:AA:BB:CC:DD:EE"
        val result = analyzer.analyze(listOf(network(bssid = bssid)), recentHistory(network(bssid = bssid)))
        assertFalse(result.first().threats.contains(ThreatType.MAC_SPOOFING_SUSPECTED))
    }

    @Test
    fun `globally-administered BSSID not flagged as MAC spoofing`() {
        // 0x00 = 0000 0000: bit 1 (locally-administered flag, mask 0x02) is clear — real manufacturer OUI
        val result = analyzer.analyze(listOf(network(bssid = "00:11:22:33:44:55")), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.MAC_SPOOFING_SUSPECTED))
    }

    // ── SUSPICIOUS_SIGNAL_STRENGTH ────────────────────────────────────────

    @Test
    fun `strong signal from new BSSID with established history flagged`() {
        val known = network(bssid = "00:11:22:33:44:55", rssi = -65)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(known)))

        // New BSSID, very strong signal — rogue device close by
        val rogue = network(bssid = "00:AA:BB:CC:DD:EE", rssi = -35)
        val result = analyzer.analyze(listOf(rogue), history)

        assertTrue(result.first().threats.contains(ThreatType.SUSPICIOUS_SIGNAL_STRENGTH))
    }

    @Test
    fun `strong signal from previously seen BSSID not flagged`() {
        val bssid = "00:11:22:33:44:55"
        val known = network(bssid = bssid, rssi = -65)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(known)))

        val current = network(bssid = bssid, rssi = -35)
        val result = analyzer.analyze(listOf(current), history)

        assertFalse(result.first().threats.contains(ThreatType.SUSPICIOUS_SIGNAL_STRENGTH))
    }

    @Test
    fun `strong signal on first scan (no history) not flagged`() {
        val result = analyzer.analyze(listOf(network(bssid = "00:AA:BB:CC:DD:EE", rssi = -35)), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.SUSPICIOUS_SIGNAL_STRENGTH))
    }

    @Test
    fun `weak signal from new BSSID not flagged for suspicious signal`() {
        val known = network(bssid = "00:11:22:33:44:55", rssi = -65)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(known)))

        val weakNew = network(bssid = "00:AA:BB:CC:DD:EE", rssi = -75)
        val result = analyzer.analyze(listOf(weakNew), history)

        assertFalse(result.first().threats.contains(ThreatType.SUSPICIOUS_SIGNAL_STRENGTH))
    }

    // ── MULTI_SSID_SAME_OUI ───────────────────────────────────────────────
    // Detects: Pineapple Karma mode / Wi-Fi Marauder SSID list spam.
    // On non-rooted Android we see beacon/probe-response frames only; actual
    // probe-REQUEST traffic from client STAs requires monitor mode (root).

    @Test
    fun `five SSIDs from same OUI with all BSSIDs already in history NOT flagged (stable enterprise)`() {
        // Enterprise controller with 5 SSIDs, all BSSIDs previously scanned → suppress false positive.
        val bssids = (1..5).map { i -> "AA:BB:CC:00:00:0$i" }
        val historicNets = bssids.mapIndexed { i, b -> network(ssid = "CorpSSID${i + 1}", bssid = b) }
        val scan = bssids.mapIndexed { i, b -> network(ssid = "CorpSSID${i + 1}", bssid = b) }
        val result = analyzer.analyze(scan, recentHistory(*historicNets.toTypedArray()))
        assertFalse(result.any { it.threats.contains(ThreatType.MULTI_SSID_SAME_OUI) })
    }

    @Test
    fun `five SSIDs from same OUI with one new BSSID still flagged (active Marauder attack)`() {
        // Four known + one brand-new BSSID from same OUI → Marauder added a new AP → still flag.
        val knownBssids = (1..4).map { i -> "AA:BB:CC:00:00:0$i" }
        val historicNets = knownBssids.mapIndexed { i, b -> network(ssid = "Corp${i + 1}", bssid = b) }
        val scan = knownBssids.mapIndexed { i, b -> network(ssid = "Corp${i + 1}", bssid = b) } +
                listOf(network(ssid = "RogueSSID", bssid = "AA:BB:CC:00:00:09"))
        val result = analyzer.analyze(scan, recentHistory(*historicNets.toTypedArray()))
        assertTrue(result.any { it.threats.contains(ThreatType.MULTI_SSID_SAME_OUI) })
    }

    @Test
    fun `five distinct SSIDs from same OUI flagged as multi-SSID spam`() {
        val scan = (1..5).map { i ->
            network(ssid = "SpamSSID$i", bssid = "AA:BB:CC:00:00:0$i")
        }
        val result = analyzer.analyze(scan, emptyList())
        assertTrue(result.all { it.threats.contains(ThreatType.MULTI_SSID_SAME_OUI) })
    }

    @Test
    fun `four distinct SSIDs from same OUI not flagged (below threshold)`() {
        val scan = (1..4).map { i ->
            network(ssid = "RouterSSID$i", bssid = "AA:BB:CC:00:00:0$i")
        }
        val result = analyzer.analyze(scan, emptyList())
        assertFalse(result.any { it.threats.contains(ThreatType.MULTI_SSID_SAME_OUI) })
    }

    @Test
    fun `five distinct SSIDs from different OUIs not flagged as multi-SSID spam`() {
        val scan = listOf(
            network(ssid = "Net1", bssid = "AA:BB:CC:00:00:01"),
            network(ssid = "Net2", bssid = "AA:BB:DD:00:00:02"),
            network(ssid = "Net3", bssid = "AA:BB:EE:00:00:03"),
            network(ssid = "Net4", bssid = "AA:BB:FF:00:00:04"),
            network(ssid = "Net5", bssid = "AA:CC:11:00:00:05")
        )
        val result = analyzer.analyze(scan, emptyList())
        assertFalse(result.any { it.threats.contains(ThreatType.MULTI_SSID_SAME_OUI) })
    }

    // ── BEACON_FLOOD ──────────────────────────────────────────────────────
    // Detects: Wi-Fi Marauder "spam ap list" / mdk4 beacon flood.
    // Same-OUI burst of brand-new BSSIDs relative to prior scan history.

    @Test
    fun `four new BSSIDs from same OUI in single scan with history flagged as beacon flood`() {
        val knownBssid = network(bssid = "AA:BB:CC:00:00:00", rssi = -70)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(knownBssid)))

        val floodScan = (1..4).map { i ->
            network(ssid = "Flood$i", bssid = "AA:BB:CC:FF:00:0$i")
        }
        val result = analyzer.analyze(floodScan, history)
        assertTrue(result.all { it.threats.contains(ThreatType.BEACON_FLOOD) })
    }

    @Test
    fun `four new BSSIDs from same OUI on first scan (no history) not flagged`() {
        val scan = (1..4).map { i ->
            network(ssid = "Flood$i", bssid = "AA:BB:CC:FF:00:0$i")
        }
        val result = analyzer.analyze(scan, emptyList())
        assertFalse(result.any { it.threats.contains(ThreatType.BEACON_FLOOD) })
    }

    @Test
    fun `three new BSSIDs from same OUI not flagged (below threshold)`() {
        val knownBssid = network(bssid = "AA:BB:CC:00:00:00", rssi = -70)
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, listOf(knownBssid)))

        val scan = (1..3).map { i ->
            network(ssid = "New$i", bssid = "AA:BB:CC:FF:00:0$i")
        }
        val result = analyzer.analyze(scan, history)
        assertFalse(result.any { it.threats.contains(ThreatType.BEACON_FLOOD) })
    }

    @Test
    fun `four BSSIDs from same OUI already in history not flagged as beacon flood`() {
        val bssids = (1..4).map { i -> "AA:BB:CC:00:00:0$i" }
        val historicNets = bssids.mapIndexed { i, b -> network(ssid = "Known${i + 1}", bssid = b) }
        val history = listOf(ScanRecord(System.currentTimeMillis() - 60_000L, historicNets))

        // Same BSSIDs appear again — not a flood, just existing APs
        val scan = bssids.mapIndexed { i, b -> network(ssid = "Known${i + 1}", bssid = b) }
        val result = analyzer.analyze(scan, history)
        assertFalse(result.any { it.threats.contains(ThreatType.BEACON_FLOOD) })
    }

    // ── INCONSISTENT_CAPABILITIES ─────────────────────────────────────────
    // Only physically impossible combinations are flagged — nothing plausible.

    @Test
    fun `2dot4 GHz + Wi-Fi 5 (11ac) flagged as inconsistent (11ac is 5 GHz-only)`() {
        val n = network(frequency = 2412, wifiStandard = WIFI_STANDARD_11AC)
        val result = analyzer.analyze(listOf(n), emptyList())
        assertTrue(result.first().threats.contains(ThreatType.INCONSISTENT_CAPABILITIES))
    }

    @Test
    fun `5 GHz + Wi-Fi 5 (11ac) NOT flagged (valid combination)`() {
        val n = network(frequency = 5180, wifiStandard = WIFI_STANDARD_11AC)
        val result = analyzer.analyze(listOf(n), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.INCONSISTENT_CAPABILITIES))
    }

    @Test
    fun `2dot4 GHz + Wi-Fi 6 (11ax) NOT flagged (Wi-Fi 6 is valid on 2dot4 GHz)`() {
        val n = network(frequency = 2412, wifiStandard = WIFI_STANDARD_11AX)
        val result = analyzer.analyze(listOf(n), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.INCONSISTENT_CAPABILITIES))
    }

    @Test
    fun `6 GHz band + Wi-Fi 4 (11n) flagged as inconsistent (6 GHz is Wi-Fi 6E or 7 only)`() {
        val n = network(frequency = 5955, wifiStandard = WIFI_STANDARD_11N)
        val result = analyzer.analyze(listOf(n), emptyList())
        assertTrue(result.first().threats.contains(ThreatType.INCONSISTENT_CAPABILITIES))
    }

    @Test
    fun `6 GHz band + Wi-Fi 6 (11ax) NOT flagged (valid combination)`() {
        val n = network(frequency = 5955, wifiStandard = WIFI_STANDARD_11AX)
        val result = analyzer.analyze(listOf(n), emptyList())
        assertFalse(result.first().threats.contains(ThreatType.INCONSISTENT_CAPABILITIES))
    }

    // ── BSSID_NEAR_CLONE ──────────────────────────────────────────────────
    // Flagged ONLY on unambiguous threat patterns; legitimate dual-band routers
    // are explicitly NOT flagged.

    @Test
    fun `same SSID, same first-4 octets, same band flagged as near-clone (rogue copy)`() {
        // Both on 2.4 GHz — a real dual-band router would use different bands.
        val scan = listOf(
            network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AA:00", frequency = 2412),
            network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AB:00", frequency = 2437)
        )
        val result = analyzer.analyze(scan, emptyList())
        assertTrue(result.all { it.threats.contains(ThreatType.BSSID_NEAR_CLONE) })
    }

    @Test
    fun `same SSID, same first-4 octets, different bands, both new — NOT flagged (legitimate dual-band router, first scan)`() {
        // Normal router first seen: 2.4 GHz + 5 GHz, sequential MACs. Must not flag.
        val scan = listOf(
            network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AA:00", frequency = 2412),
            network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AB:00", frequency = 5180)
        )
        val result = analyzer.analyze(scan, emptyList())
        assertFalse(result.any { it.threats.contains(ThreatType.BSSID_NEAR_CLONE) })
    }

    @Test
    fun `same SSID, same first-4 octets, different bands, both already known — NOT flagged (stable dual-band router)`() {
        // Router seen many times — both BSSIDs in history. Suppress false positive.
        val legit24 = network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AA:00", frequency = 2412)
        val legit5  = network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AB:00", frequency = 5180)
        val result = analyzer.analyze(listOf(legit24, legit5), recentHistory(legit24, legit5))
        assertFalse(result.any { it.threats.contains(ThreatType.BSSID_NEAR_CLONE) })
    }

    @Test
    fun `same SSID, same first-4 octets, different bands, peer known but this BSSID new — flagged (rogue insertion)`() {
        // Attacker sees existing 2.4 GHz BSSID :AA and creates rogue :AB on 5 GHz.
        val known24 = network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AA:00", frequency = 2412)
        val rogue5  = network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AB:00", frequency = 5180)
        // Only the 2.4 GHz BSSID is in history; the 5 GHz one is brand new.
        val result = analyzer.analyze(listOf(known24, rogue5), recentHistory(known24))
        assertTrue(result.find { it.bssid == rogue5.bssid }!!.threats.contains(ThreatType.BSSID_NEAR_CLONE))
    }

    @Test
    fun `different SSIDs with same first-4 BSSID octets NOT flagged`() {
        // ISP AP and neighbour AP that share the same vendor OUI prefix — not a threat.
        val scan = listOf(
            network(ssid = "Net1", bssid = "5F:5F:F4:66:AA:00", frequency = 2412),
            network(ssid = "Net2", bssid = "5F:5F:F4:66:AB:00", frequency = 2412)
        )
        val result = analyzer.analyze(scan, emptyList())
        assertFalse(result.any { it.threats.contains(ThreatType.BSSID_NEAR_CLONE) })
    }

    @Test
    fun `same SSID, completely different BSSID prefixes NOT flagged`() {
        // Two APs for same SSID (mesh extenders) with totally different MACs — normal.
        val scan = listOf(
            network(ssid = "HomeNet", bssid = "5F:5F:F4:66:AA:00", frequency = 2412),
            network(ssid = "HomeNet", bssid = "AA:BB:CC:DD:EE:FF", frequency = 5180)
        )
        val result = analyzer.analyze(scan, emptyList())
        assertFalse(result.any { it.threats.contains(ThreatType.BSSID_NEAR_CLONE) })
    }
}
