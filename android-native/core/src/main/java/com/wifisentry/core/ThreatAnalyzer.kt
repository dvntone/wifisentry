package com.wifisentry.core

/**
 * Heuristic threat analyzer for Wi-Fi networks.
 *
 * All analysis is purely local; no network calls are made.
 */
class ThreatAnalyzer(
    private val suspiciousKeywords: List<String> = DEFAULT_SUSPICIOUS_KEYWORDS,
    private val recentWindowMs: Long = DEFAULT_RECENT_WINDOW_MS
) {

    /**
     * Analyse a list of raw scan results and annotate them with detected threats,
     * taking previous scan history into account where needed.
     */
    fun analyze(
        networks: List<ScannedNetwork>,
        history: List<ScanRecord>
    ): List<ScannedNetwork> {
        // Pre-compute the full set of known BSSIDs once; used by multiple checks.
        val knownBssids = history.flatMap { it.networks }.map { it.bssid }.toSet()

        return networks.map { network ->
            val threats = mutableListOf<ThreatType>()

            if (isOpenNetwork(network)) {
                threats += ThreatType.OPEN_NETWORK
            }
            if (hasSuspiciousKeyword(network.ssid)) {
                threats += ThreatType.SUSPICIOUS_SSID
            }
            if (hasMultipleBssids(network.ssid, networks, history)) {
                threats += ThreatType.MULTIPLE_BSSIDS
            }
            if (hasSecurityChange(network, history)) {
                threats += ThreatType.SECURITY_CHANGE
            }
            if (isEvilTwin(network, history)) {
                threats += ThreatType.EVIL_TWIN
            }
            if (isMacSpoofingSuspected(network, knownBssids)) {
                threats += ThreatType.MAC_SPOOFING_SUSPECTED
            }
            if (isSuspiciousSignalStrength(network, knownBssids)) {
                threats += ThreatType.SUSPICIOUS_SIGNAL_STRENGTH
            }
            if (hasMultipleSsidsFromSameOui(network, networks, knownBssids)) {
                threats += ThreatType.MULTI_SSID_SAME_OUI
            }
            if (isBeaconFlood(network, networks, knownBssids)) {
                threats += ThreatType.BEACON_FLOOD
            }
            if (isInconsistentCapabilities(network)) {
                threats += ThreatType.INCONSISTENT_CAPABILITIES
            }
            if (isBssidNearClone(network, networks, knownBssids)) {
                threats += ThreatType.BSSID_NEAR_CLONE
            }
            if (isWpsVulnerable(network)) {
                threats += ThreatType.WPS_VULNERABLE
            }
            if (hasChannelShift(network, history)) {
                threats += ThreatType.CHANNEL_SHIFT
            }

            network.copy(threats = threats)
        }
    }

    // ── individual checks ──────────────────────────────────────────────────

    private fun isOpenNetwork(network: ScannedNetwork): Boolean {
        val caps = network.capabilities.uppercase()
        return !caps.contains("WPA") && !caps.contains("WEP") && !caps.contains("SAE")
    }

    private fun hasSuspiciousKeyword(ssid: String): Boolean {
        val lower = ssid.lowercase()
        return suspiciousKeywords.any { lower.contains(it.lowercase()) }
    }

    /**
     * True when the same SSID appears with more than one distinct BSSID within
     * the current scan and/or the recent history window.
     */
    private fun hasMultipleBssids(
        ssid: String,
        currentScan: List<ScannedNetwork>,
        history: List<ScanRecord>
    ): Boolean {
        if (ssid.isBlank()) return false

        val bssids = mutableSetOf<String>()

        // Collect BSSIDs from the current scan
        currentScan
            .filter { it.ssid == ssid && it.bssid.isNotBlank() }
            .forEach { bssids += it.bssid }

        // Collect BSSIDs from recent history
        val cutoff = System.currentTimeMillis() - recentWindowMs
        history
            .filter { it.timestampMs >= cutoff }
            .flatMap { it.networks }
            .filter { it.ssid == ssid && it.bssid.isNotBlank() }
            .forEach { bssids += it.bssid }

        return bssids.size > 1
    }

    /**
     * True when the security capabilities for this SSID differ from the most
     * recent historical observation of the same SSID.
     */
    private fun hasSecurityChange(
        network: ScannedNetwork,
        history: List<ScanRecord>
    ): Boolean {
        if (network.ssid.isBlank()) return false

        val previous = history
            .sortedByDescending { it.timestampMs }
            .flatMap { it.networks }
            .firstOrNull { it.ssid == network.ssid }
            ?: return false

        return normaliseCaps(previous.capabilities) != normaliseCaps(network.capabilities)
    }

    /** Strip infrastructure/feature tags and retain only the security tokens. */
    private fun normaliseCaps(caps: String): String {
        return caps.uppercase()
            .replace(Regex("\\[ESS]"), "")
            .replace(Regex("\\[BSS]"), "")
            .replace(Regex("\\[IBSS]"), "")
            .replace(Regex("\\[WPS]"), "")
            .trim()
    }

    /**
     * True when the network is open AND the same SSID was previously observed
     * as a secured network with a different BSSID.
     *
     * This is the canonical evil-twin / Wi-Fi Pineapple / Karma impersonation
     * signature: an attacker clones a known SSID but cannot replicate the
     * legitimate AP's MAC address or security configuration.
     */
    private fun isEvilTwin(
        network: ScannedNetwork,
        history: List<ScanRecord>
    ): Boolean {
        if (!isOpenNetwork(network)) return false
        if (network.ssid.isBlank()) return false

        val allHistoric = history.flatMap { it.networks }

        // SSID must have been seen as a secured network at some point
        val seenAsSecured = allHistoric.any { it.ssid == network.ssid && !isOpenNetwork(it) }
        if (!seenAsSecured) return false

        // Current BSSID must be new — not previously associated with this SSID
        val knownBssids = allHistoric
            .filter { it.ssid == network.ssid }
            .map { it.bssid }
            .toSet()
        return network.bssid.isNotBlank() && network.bssid !in knownBssids
    }

    /**
     * True when the BSSID has the locally-administered bit set (first-octet
     * bit 1 = 1, mask 0x02) AND the BSSID has not been seen in any prior scan.
     *
     * Every legitimate Wi-Fi AP ships with a globally-administered MAC address
     * assigned by its manufacturer.  A locally-administered BSSID indicates a
     * software-defined radio, a virtualised AP, or a deliberately spoofed MAC —
     * all common in rogue-AP and evil-twin toolkits.
     *
     * However, enterprise Wi-Fi controllers (Cisco WLC, Aruba, Meraki) legitimately
     * assign locally-administered BSSIDs to create AP pools.  These produce a stable
     * BSSID that persists across scans.  To suppress that false positive, we only
     * flag a locally-administered MAC when it is brand new — not yet present in any
     * prior scan history.  A rogue device will always appear as new; a known
     * enterprise AP will be suppressed after the first scan.
     */
    private fun isMacSpoofingSuspected(network: ScannedNetwork, knownBssids: Set<String>): Boolean {
        // toIntOrNull(16) parses the hex octet string (e.g. "02") as base-16 without a "0x" prefix.
        val firstOctet = network.bssid.split(":").firstOrNull()?.toIntOrNull(16) ?: return false
        // Bit 1 (second-least-significant bit, mask 0x02) is the locally-administered flag.
        if ((firstOctet and 0x02) == 0) return false
        // Suppress if this BSSID has been seen before — it is a known, stable enterprise AP.
        if (knownBssids.isNotEmpty() && network.bssid in knownBssids) return false
        return true
    }

    /**
     * True when a previously-unseen BSSID is advertising with an unusually
     * strong signal ([SUSPICIOUS_RSSI_THRESHOLD] dBm or above) and there is
     * already established scan history to use as a baseline.
     *
     * A rogue device such as a Wi-Fi Pineapple carried in a bag at an adjacent
     * table typically produces a signal far stronger than any legitimate AP in
     * the same venue.  Requiring existing history prevents false-positives on
     * the very first scan in a new environment.
     */
    private fun isSuspiciousSignalStrength(
        network: ScannedNetwork,
        knownBssids: Set<String>
    ): Boolean {
        if (knownBssids.isEmpty()) return false
        if (network.rssi < SUSPICIOUS_RSSI_THRESHOLD) return false
        return network.bssid.isNotBlank() && network.bssid !in knownBssids
    }

    /**
     * True when five or more distinct SSIDs are advertised by APs that share
     * the same hardware OUI (first three BSSID octets) within the current scan,
     * AND at least one of those same-OUI BSSIDs is not yet present in history.
     *
     * A home or office router may legitimately serve 2–4 SSIDs from a single
     * radio (main 2.4 GHz, main 5 GHz, guest 2.4 GHz, guest 5 GHz).  Five or
     * more different SSIDs from the same OUI is abnormal and matches the output
     * of a Wi-Fi Pineapple running Karma mode or Wi-Fi Marauder's beacon-spam
     * "ap list" command, which floods the air with many virtual SSIDs.
     *
     * The history guard suppresses false positives from stable enterprise
     * deployments: an enterprise controller that has advertised 5+ SSIDs under
     * one OUI for multiple scans will have all its BSSIDs in history and will
     * not be re-flagged.  A Marauder attack always introduces new BSSIDs.
     *
     * Note: on non-rooted Android we observe beacon/probe-response frames only;
     * actual probe-request frames from client STAs require monitor mode (root).
     */
    private fun hasMultipleSsidsFromSameOui(
        network: ScannedNetwork,
        currentScan: List<ScannedNetwork>,
        knownBssids: Set<String>
    ): Boolean {
        val oui = ouiOf(network.bssid) ?: return false
        val sameOuiNetworks = currentScan.filter { ouiOf(it.bssid) == oui && it.ssid.isNotBlank() }
        val ssids = sameOuiNetworks.map { it.ssid }.toSet()
        if (ssids.size < MULTI_SSID_OUI_THRESHOLD) return false
        // Suppress if every BSSID in this OUI group was already known from history —
        // it is a stable, previously-observed deployment, not an active attack.
        if (knownBssids.isNotEmpty() && sameOuiNetworks.all { it.bssid in knownBssids }) return false
        return true
    }

    /**
     * True when four or more brand-new BSSIDs sharing the same OUI have
     * appeared in the current scan without any prior presence in scan history.
     *
     * Wi-Fi Marauder's "spam ap list" and similar beacon-flood tools
     * (hostapd-wpe, mdk3/mdk4) create many virtual APs in rapid succession.
     * All virtual APs share the same physical radio OUI, producing a burst of
     * many same-OUI BSSIDs that have never appeared before.  Requiring a
     * history baseline prevents false-positives on the very first scan in a
     * new environment.
     */
    private fun isBeaconFlood(
        network: ScannedNetwork,
        currentScan: List<ScannedNetwork>,
        knownBssids: Set<String>
    ): Boolean {
        if (knownBssids.isEmpty()) return false
        val oui = ouiOf(network.bssid) ?: return false
        val newBssidsFromOui = currentScan
            .filter { ouiOf(it.bssid) == oui && it.bssid.isNotBlank() }
            .map { it.bssid }
            .toSet()
            .count { it !in knownBssids }
        return newBssidsFromOui >= BEACON_FLOOD_THRESHOLD
    }

    /** Returns the OUI portion (first three colon-separated octets) of a BSSID,
     *  or null if the BSSID is malformed or any octet is not two hex digits. */
    private fun ouiOf(bssid: String): String? {
        val parts = bssid.split(":")
        if (parts.size < 3) return null
        val hexOctet = Regex("^[0-9A-Fa-f]{2}$")
        if (parts.take(3).any { !it.matches(hexOctet) }) return null
        return "${parts[0]}:${parts[1]}:${parts[2]}"
    }

    /**
     * True when the AP's advertised Wi-Fi standard is physically incompatible
     * with its operating frequency.  Only two combinations are physically
     * impossible on real hardware — everything else is left unflagged:
     *
     * 1. 2.4 GHz band + Wi-Fi 5 (802.11ac): 802.11ac is a 5 GHz–only
     *    specification.  An AP beacon on 2.4 GHz cannot legitimately claim it.
     * 2. 6 GHz band (5925–7125 MHz) + any standard older than Wi-Fi 6: the
     *    6 GHz band was introduced exclusively for 802.11ax (Wi-Fi 6E) and
     *    802.11be (Wi-Fi 7); older standards cannot operate there.
     *
     * These mismatches indicate a software-defined rogue AP fabricating its
     * capability advertisement (Pineapple, Marauder, hostapd-wpe).
     */
    private fun isInconsistentCapabilities(network: ScannedNetwork): Boolean {
        val std  = network.wifiStandard
        val freq = network.frequency
        if (std == WIFI_STANDARD_UNKNOWN) return false   // no data — do not flag

        // Rule 1: Wi-Fi 5 (802.11ac) is 5 GHz–only; impossible on 2.4 GHz.
        if (freq in 2400..2499 && std == WIFI_STANDARD_11AC) return true

        // Rule 2: 6 GHz band is Wi-Fi 6E/7 only; pre–Wi-Fi 6 standards cannot appear here.
        if (freq in 5925..7125 && std != WIFI_STANDARD_11AX && std != WIFI_STANDARD_11BE) return true

        return false
    }

    /**
     * True when this AP's BSSID shares the same first four octets as another
     * AP in the scan with the same SSID, yet the last two octets differ — a
     * near-clone BSSID.
     *
     * Legitimate dual-band routers do use sequential MACs across bands (e.g.
     * 5f:5f:f4:66:aa on 2.4 GHz, 5f:5f:f4:66:ab on 5 GHz), so the near-clone
     * pattern alone is NOT flagged.  Flagging only occurs when one of these
     * unambiguously threat-indicative conditions is true:
     *
     * 1. Same frequency band: two near-identical BSSIDs on the SAME band for
     *    the same SSID.  A real dual-band router always places its radios on
     *    different bands; same-band near-clones are physically impossible for
     *    legitimate hardware and indicate a rogue copy.
     *
     * 2. Cross-band + new BSSID: the near-clone BSSID is brand-new (absent
     *    from all prior scan history) while the matching peer BSSID WAS already
     *    known.  This is the rogue-insertion pattern — an attacker introduces
     *    a spoofed "other-band" entry alongside an established legitimate AP.
     *    NOT triggered on the first scan (no history → no baseline) to avoid
     *    false-positives for legitimate dual-band routers seen for the first time.
     */
    private fun isBssidNearClone(
        network: ScannedNetwork,
        currentScan: List<ScannedNetwork>,
        knownBssids: Set<String>
    ): Boolean {
        if (network.ssid.isBlank() || network.bssid.isBlank()) return false
        val myPrefix = first4Octets(network.bssid) ?: return false
        val myBand   = bandOf(network.frequency)

        val peers = currentScan.filter { other ->
            other.bssid != network.bssid &&
            other.ssid  == network.ssid  &&
            first4Octets(other.bssid) == myPrefix
        }
        if (peers.isEmpty()) return false

        for (peer in peers) {
            // Condition 1: same-band near-clone — always a threat.
            if (myBand != 0 && bandOf(peer.frequency) == myBand) return true

            // Condition 2: cross-band, but this BSSID is new while the peer was known.
            // Both new (first scan) and both known (stable router) are NOT flagged.
            if (knownBssids.isNotEmpty() &&
                peer.bssid in knownBssids &&
                network.bssid !in knownBssids) return true
        }
        return false
    }

    /**
     * Returns the first four colon-separated octets of a BSSID as a prefix
     * string, or null if the BSSID is malformed.  Used for near-clone detection.
     */
    private fun first4Octets(bssid: String): String? {
        val parts = bssid.split(":")
        if (parts.size != 6) return null
        val hexOctet = Regex("^[0-9A-Fa-f]{2}$")
        if (parts.any { !it.matches(hexOctet) }) return null
        return "${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}"
    }

    /**
     * Returns the nominal frequency band for a channel centre frequency in MHz:
     * 2 = 2.4 GHz, 5 = 5 GHz, 6 = 6 GHz (Wi-Fi 6E/7), 0 = unknown / other.
     */
    private fun bandOf(frequency: Int): Int = when {
        frequency in 2400..2499 -> 2
        frequency in 4900..5924 -> 5
        frequency in 5925..7125 -> 6
        else                    -> 0
    }

    // ── non-root checks (ScanResult data only) ────────────────────────────

    /**
     * True when the AP advertises WPS in its capabilities string.
     *
     * WPS PIN mode is vulnerable to offline brute-force attacks (Pixie Dust,
     * Reaver).  The "[WPS]" token is always present in
     * [android.net.wifi.ScanResult.capabilities] when WPS is enabled.
     */
    private fun isWpsVulnerable(network: ScannedNetwork): Boolean =
        network.capabilities.contains("[WPS]", ignoreCase = true)

    /**
     * True when the BSSID was previously observed on a different frequency
     * band (e.g. 2.4 GHz → 5 GHz).
     *
     * Legitimate APs are fixed to one band by their hardware radio.  A BSSID
     * that moves between bands between scans is consistent with a rogue device
     * impersonating the AP from a different radio (cheap SDR or Pineapple with
     * dual-band capability).
     *
     * Not flagged when there is no prior history for the BSSID (first scan
     * avoids false positives on dual-band routers not yet in history).
     */
    private fun hasChannelShift(network: ScannedNetwork, history: List<ScanRecord>): Boolean {
        if (network.bssid.isBlank() || network.frequency <= 0) return false

        val previousFreq = history
            .sortedByDescending { it.timestampMs }
            .flatMap { it.networks }
            .firstOrNull { it.bssid == network.bssid }
            ?.frequency ?: return false   // not seen before — do not flag

        return bandOf(network.frequency) != bandOf(previousFreq) &&
               bandOf(network.frequency) != 0 &&
               bandOf(previousFreq) != 0
    }

    // ── root-aware public overload ─────────────────────────────────────────

    /**
     * Root-aware overload that additionally applies [ThreatType.DEAUTH_FLOOD]
     * and [ThreatType.PROBE_RESPONSE_ANOMALY] when root-derived frame data is
     * supplied.
     *
     * On non-rooted devices pass [RootScanData] with defaults (rootActive =
     * false) and this behaves identically to the two-argument overload.
     */
    fun analyze(
        networks: List<ScannedNetwork>,
        history: List<ScanRecord>,
        rootData: RootScanData,
    ): List<ScannedNetwork> {
        val base = analyze(networks, history)
        if (!rootData.rootActive) return base

        val knownSsids = networks.map { it.ssid }.toSet()
        val deauthFlood = rootData.deauthFrameCount >= RootShellScanner.DEAUTH_FLOOD_THRESHOLD

        // Annotate every beaconing network with environmental root threats
        val annotated = base.map { network ->
            val extra = mutableListOf<ThreatType>()
            if (deauthFlood) extra += ThreatType.DEAUTH_FLOOD
            if (extra.isEmpty()) network else network.copy(threats = network.threats + extra)
        }.toMutableList()

        // Synthetic entries for SSIDs seen only in probe-responses (Karma signature)
        for (ssid in rootData.probeOnlySsids) {
            if (ssid.isNotBlank() && ssid !in knownSsids) {
                annotated += ScannedNetwork(
                    ssid         = ssid,
                    bssid        = "",
                    capabilities = "",
                    rssi         = 0,
                    frequency    = 0,
                    timestamp    = System.currentTimeMillis(),
                    threats      = listOf(ThreatType.PROBE_RESPONSE_ANOMALY),
                )
            }
        }

        return annotated
    }

    companion object {
        private const val DEFAULT_RECENT_WINDOW_MS = 10L * 60 * 1000 // 10 minutes

        /** dBm above which a brand-new BSSID is considered suspiciously close. */
        private const val SUSPICIOUS_RSSI_THRESHOLD = -40  // dBm

        /** Minimum distinct SSIDs from one OUI to flag as multi-SSID spam. */
        private const val MULTI_SSID_OUI_THRESHOLD = 5

        /** Minimum new BSSIDs from one OUI in a single scan to flag as a beacon flood. */
        private const val BEACON_FLOOD_THRESHOLD = 4

        // "test" and "probe" were intentionally excluded: as substrings they match far too many
        // legitimate SSIDs ("TestNetwork", "ContestWifi", "ProbeStreet") with no meaningful
        // signal gain for Marauder/Pineapple detection.
        val DEFAULT_SUSPICIOUS_KEYWORDS = listOf(
            "free", "guest", "public", "open", "hack", "evil", "pineapple",
            "starbucks", "airport", "hotel", "setup",
            "karma", "rogue", "pentest", "kali"
        )
    }
}
