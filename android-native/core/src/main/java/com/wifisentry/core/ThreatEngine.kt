package com.wifisentry.core

/**
 * ThreatEngine — unified Wi-Fi threat detection combining scan-level heuristics
 * with frame-level attack detection.
 *
 * ## Scan-level analysis (no root required)
 * [analyze] runs on every [List<ScannedNetwork>] from WifiManager and detects:
 * evil twins, MAC spoofing, beacon floods, WPS vulnerabilities, channel shifts,
 * BSSID near-clones, and more — using only data available in stock Android scan results.
 *
 * ## Frame-level analysis (root + monitor mode required)
 * [analyzeDeauthFrame], [analyzeEapolFrame], and [recordAssociation] process captured
 * 802.11 management and EAPOL frames and detect:
 * - Deauthentication floods (rolling 10-second window)
 * - PMKID harvest attempts (EAPOL M1 from unassociated client)
 * - KRACK key-reinstallation attacks (duplicate M3 replay counters)
 *
 * Call [reset] when a scan session ends to clear all frame-level state.
 */
class ThreatEngine(
    private val suspiciousKeywords: List<String> = DEFAULT_SUSPICIOUS_KEYWORDS,
    private val recentWindowMs: Long = DEFAULT_RECENT_WINDOW_MS,
) {

    // ── Frame-level state (from AttackHeuristics) ─────────────────────────

    /** Maps BSSID → rolling list of Deauth frame timestamps within [DEAUTH_WINDOW_MS]. */
    private val deauthFrameLog = mutableMapOf<String, MutableList<Long>>()

    /** Maps BSSID → set of known-associated client MACs (for PMKID detection). */
    private val associatedClients = mutableMapOf<String, MutableSet<String>>()

    /** Maps "bssid:sourceMac" → EAPOL M3 replay counters (for KRACK detection). */
    private val eapolM3Counters = mutableMapOf<String, MutableList<Long>>()

    // ── Scan-level analysis ───────────────────────────────────────────────

    /**
     * Analyse a list of raw scan results and annotate them with detected threats,
     * taking previous scan history into account where needed.
     */
    fun analyze(
        networks: List<ScannedNetwork>,
        history: List<ScanRecord>,
    ): List<ScannedNetwork> {
        val knownBssids = history.flatMap { it.networks }.map { it.bssid }.toSet()
        return networks.map { network ->
            val threats = mutableListOf<ThreatType>()
            if (isOpenNetwork(network))                                    threats += ThreatType.OPEN_NETWORK
            if (hasSuspiciousKeyword(network.ssid))                        threats += ThreatType.SUSPICIOUS_SSID
            if (hasMultipleBssids(network.ssid, networks, history))        threats += ThreatType.MULTIPLE_BSSIDS
            if (hasSecurityChange(network, history))                       threats += ThreatType.SECURITY_CHANGE
            if (isEvilTwin(network, history))                              threats += ThreatType.EVIL_TWIN
            if (isMacSpoofingSuspected(network, knownBssids))             threats += ThreatType.MAC_SPOOFING_SUSPECTED
            if (isSuspiciousSignalStrength(network, knownBssids))         threats += ThreatType.SUSPICIOUS_SIGNAL_STRENGTH
            if (hasMultipleSsidsFromSameOui(network, networks, knownBssids)) threats += ThreatType.MULTI_SSID_SAME_OUI
            if (isBeaconFlood(network, networks, knownBssids))            threats += ThreatType.BEACON_FLOOD
            if (isInconsistentCapabilities(network))                       threats += ThreatType.INCONSISTENT_CAPABILITIES
            if (isBssidNearClone(network, networks, knownBssids))         threats += ThreatType.BSSID_NEAR_CLONE
            if (isWpsVulnerable(network))                                  threats += ThreatType.WPS_VULNERABLE
            if (hasChannelShift(network, history))                         threats += ThreatType.CHANNEL_SHIFT
            network.copy(threats = threats)
        }
    }

    /**
     * Root-aware overload — additionally applies [ThreatType.DEAUTH_FLOOD] and
     * [ThreatType.PROBE_RESPONSE_ANOMALY] when root-derived frame data is supplied.
     * On non-rooted devices pass [RootScanData] with defaults and this behaves
     * identically to the two-argument overload.
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

    // ── Frame-level analysis ──────────────────────────────────────────────

    /**
     * Record a Deauth / Disassociation management frame and detect flooding.
     * Uses a rolling [DEAUTH_WINDOW_MS] window; returns a [FrameThreatEvent]
     * when the threshold is reached, null otherwise.
     */
    fun analyzeDeauthFrame(frame: DeauthFrame): FrameThreatEvent? {
        val now = frame.timestampMs
        val timestamps = deauthFrameLog.getOrPut(frame.bssid) { mutableListOf() }
        timestamps += now
        timestamps.removeAll { it < now - DEAUTH_WINDOW_MS }
        if (timestamps.isEmpty()) {
            deauthFrameLog.remove(frame.bssid)
            return null
        }
        if (timestamps.size < deauthThreshold) return null

        val broadcast = frame.destMac.equals("ff:ff:ff:ff:ff:ff", ignoreCase = true)
        // Elevate to HIGH for broadcast deauth (targets all clients simultaneously)
        val type = if (broadcast) ThreatType.DEAUTH_FLOOD else ThreatType.DEAUTH_FLOOD
        return FrameThreatEvent(
            threatType  = type,
            bssid       = frame.bssid,
            ssid        = "",
            description = "${timestamps.size} Deauth frames in ${DEAUTH_WINDOW_MS / 1000}s " +
                "from BSSID ${frame.bssid} targeting ${frame.destMac}.",
        )
    }

    /**
     * Mark a client MAC as associated with an AP (required for accurate PMKID detection).
     * Call this whenever an 802.11 Association Response is captured.
     */
    fun recordAssociation(clientMac: String, bssid: String) {
        if (associatedClients.size < MAX_TRACKED_ENTRIES || associatedClients.containsKey(bssid)) {
            associatedClients.getOrPut(bssid) { mutableSetOf() } += clientMac
        }
    }

    /**
     * Analyse an EAPOL frame for PMKID sniffing (M1 from unassociated client)
     * and KRACK (duplicate M3 replay counter).
     * Returns a list of [FrameThreatEvent]s — may contain both when both are observed.
     */
    fun analyzeEapolFrame(frame: EapolFrame): List<FrameThreatEvent> {
        val threats = mutableListOf<FrameThreatEvent>()

        // PMKID: M1 from a MAC that was never associated
        if (frame.messageNumber == 1) {
            val isAssociated = associatedClients[frame.bssid]?.contains(frame.sourceMac) == true
            if (!isAssociated) {
                threats += FrameThreatEvent(
                    threatType  = ThreatType.PMKID_SNIFFING,
                    bssid       = frame.bssid,
                    ssid        = "",
                    description = "EAPOL M1 from unassociated MAC ${frame.sourceMac} " +
                        "targeting AP ${frame.bssid}. Possible PMKID harvest attempt.",
                )
            }
        }

        // KRACK: duplicate M3 replay counter from the same AP
        if (frame.messageNumber == 3) {
            val key = "${frame.bssid}:${frame.sourceMac}"
            if (eapolM3Counters.size >= MAX_TRACKED_ENTRIES && !eapolM3Counters.containsKey(key)) {
                return threats
            }
            val counters = eapolM3Counters.getOrPut(key) { mutableListOf() }
            if (frame.replayCounter in counters) {
                threats += FrameThreatEvent(
                    threatType  = ThreatType.KRACK,
                    bssid       = frame.bssid,
                    ssid        = "",
                    description = "Duplicate EAPOL M3 replay counter (${frame.replayCounter}) " +
                        "from AP ${frame.bssid} — possible KRACK nonce-reuse attack.",
                )
            } else {
                counters += frame.replayCounter
            }
        }

        return threats
    }

    /** Clear all frame-level state. Call when a scan session ends. */
    fun reset() {
        deauthFrameLog.clear()
        associatedClients.clear()
        eapolM3Counters.clear()
    }

    // ── Scan-level checks (identical to former ThreatAnalyzer) ───────────

    private fun isOpenNetwork(network: ScannedNetwork): Boolean {
        val caps = network.capabilities.uppercase()
        return !caps.contains("WPA") && !caps.contains("WEP") && !caps.contains("SAE")
    }

    private fun hasSuspiciousKeyword(ssid: String): Boolean {
        val lower = ssid.lowercase()
        return suspiciousKeywords.any { lower.contains(it.lowercase()) }
    }

    private fun hasMultipleBssids(
        ssid: String,
        currentScan: List<ScannedNetwork>,
        history: List<ScanRecord>,
    ): Boolean {
        if (ssid.isBlank()) return false
        val bssids = mutableSetOf<String>()
        currentScan.filter { it.ssid == ssid && it.bssid.isNotBlank() }.forEach { bssids += it.bssid }
        val cutoff = System.currentTimeMillis() - recentWindowMs
        history.filter { it.timestampMs >= cutoff }
            .flatMap { it.networks }
            .filter { it.ssid == ssid && it.bssid.isNotBlank() }
            .forEach { bssids += it.bssid }
        return bssids.size > 1
    }

    private fun hasSecurityChange(network: ScannedNetwork, history: List<ScanRecord>): Boolean {
        if (network.ssid.isBlank()) return false
        val previous = history.sortedByDescending { it.timestampMs }
            .flatMap { it.networks }
            .firstOrNull { it.ssid == network.ssid } ?: return false
        return normaliseCaps(previous.capabilities) != normaliseCaps(network.capabilities)
    }

    private fun normaliseCaps(caps: String): String =
        caps.uppercase()
            .replace(Regex("\\[ESS]"), "")
            .replace(Regex("\\[BSS]"), "")
            .replace(Regex("\\[IBSS]"), "")
            .replace(Regex("\\[WPS]"), "")
            .trim()

    private fun isEvilTwin(network: ScannedNetwork, history: List<ScanRecord>): Boolean {
        if (!isOpenNetwork(network) || network.ssid.isBlank()) return false
        val allHistoric = history.flatMap { it.networks }
        val seenAsSecured = allHistoric.any { it.ssid == network.ssid && !isOpenNetwork(it) }
        if (!seenAsSecured) return false
        val knownBssids = allHistoric.filter { it.ssid == network.ssid }.map { it.bssid }.toSet()
        return network.bssid.isNotBlank() && network.bssid !in knownBssids
    }

    private fun isMacSpoofingSuspected(network: ScannedNetwork, knownBssids: Set<String>): Boolean {
        val firstOctet = network.bssid.split(":").firstOrNull()?.toIntOrNull(16) ?: return false
        if ((firstOctet and 0x02) == 0) return false
        if (knownBssids.isNotEmpty() && network.bssid in knownBssids) return false
        return true
    }

    private fun isSuspiciousSignalStrength(network: ScannedNetwork, knownBssids: Set<String>): Boolean {
        if (knownBssids.isEmpty()) return false
        if (network.rssi < SUSPICIOUS_RSSI_THRESHOLD) return false
        return network.bssid.isNotBlank() && network.bssid !in knownBssids
    }

    private fun hasMultipleSsidsFromSameOui(
        network: ScannedNetwork,
        currentScan: List<ScannedNetwork>,
        knownBssids: Set<String>,
    ): Boolean {
        val oui = ouiOf(network.bssid) ?: return false
        val sameOuiNetworks = currentScan.filter { ouiOf(it.bssid) == oui && it.ssid.isNotBlank() }
        if (sameOuiNetworks.map { it.ssid }.toSet().size < MULTI_SSID_OUI_THRESHOLD) return false
        if (knownBssids.isNotEmpty() && sameOuiNetworks.all { it.bssid in knownBssids }) return false
        return true
    }

    private fun isBeaconFlood(
        network: ScannedNetwork,
        currentScan: List<ScannedNetwork>,
        knownBssids: Set<String>,
    ): Boolean {
        if (knownBssids.isEmpty()) return false
        val oui = ouiOf(network.bssid) ?: return false
        val newBssidsFromOui = currentScan
            .filter { ouiOf(it.bssid) == oui && it.bssid.isNotBlank() }
            .map { it.bssid }.toSet()
            .count { it !in knownBssids }
        return newBssidsFromOui >= BEACON_FLOOD_THRESHOLD
    }

    private fun ouiOf(bssid: String): String? {
        val parts = bssid.split(":")
        if (parts.size < 3) return null
        val hexOctet = Regex("^[0-9A-Fa-f]{2}$")
        if (parts.take(3).any { !it.matches(hexOctet) }) return null
        return "${parts[0]}:${parts[1]}:${parts[2]}"
    }

    private fun isInconsistentCapabilities(network: ScannedNetwork): Boolean {
        val std  = network.wifiStandard
        val freq = network.frequency
        if (std == WIFI_STANDARD_UNKNOWN) return false
        if (freq in 2400..2499 && std == WIFI_STANDARD_11AC) return true
        if (freq in 5925..7125 && std != WIFI_STANDARD_11AX && std != WIFI_STANDARD_11BE) return true
        return false
    }

    private fun isBssidNearClone(
        network: ScannedNetwork,
        currentScan: List<ScannedNetwork>,
        knownBssids: Set<String>,
    ): Boolean {
        if (network.ssid.isBlank() || network.bssid.isBlank()) return false
        val myPrefix = first4Octets(network.bssid) ?: return false
        val myBand   = bandOf(network.frequency)
        val peers    = currentScan.filter { other ->
            other.bssid != network.bssid && other.ssid == network.ssid &&
            first4Octets(other.bssid) == myPrefix
        }
        if (peers.isEmpty()) return false
        for (peer in peers) {
            if (myBand != 0 && bandOf(peer.frequency) == myBand) return true
            if (knownBssids.isNotEmpty() && peer.bssid in knownBssids && network.bssid !in knownBssids) return true
        }
        return false
    }

    private fun first4Octets(bssid: String): String? {
        val parts = bssid.split(":")
        if (parts.size != 6) return null
        val hexOctet = Regex("^[0-9A-Fa-f]{2}$")
        if (parts.any { !it.matches(hexOctet) }) return null
        return "${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}"
    }

    private fun bandOf(frequency: Int): Int = when {
        frequency in 2400..2499 -> 2
        frequency in 4900..5924 -> 5
        frequency in 5925..7125 -> 6
        else                    -> 0
    }

    private fun isWpsVulnerable(network: ScannedNetwork): Boolean =
        network.capabilities.contains("[WPS]", ignoreCase = true)

    private fun hasChannelShift(network: ScannedNetwork, history: List<ScanRecord>): Boolean {
        if (network.bssid.isBlank() || network.frequency <= 0) return false
        val previousFreq = history.sortedByDescending { it.timestampMs }
            .flatMap { it.networks }
            .firstOrNull { it.bssid == network.bssid }
            ?.frequency ?: return false
        return bandOf(network.frequency) != bandOf(previousFreq) &&
               bandOf(network.frequency) != 0 && bandOf(previousFreq) != 0
    }

    // ── Constants ─────────────────────────────────────────────────────────

    companion object {
        private const val DEFAULT_RECENT_WINDOW_MS  = 10L * 60 * 1000
        private const val SUSPICIOUS_RSSI_THRESHOLD = -40
        private const val MULTI_SSID_OUI_THRESHOLD  = 5
        private const val BEACON_FLOOD_THRESHOLD     = 4

        /** Rolling window for deauth flood detection (milliseconds). */
        const val DEAUTH_WINDOW_MS = 10_000L

        /** Deauth frames within [DEAUTH_WINDOW_MS] required to trigger a flood alert. */
        const val DEFAULT_DEAUTH_THRESHOLD = 15

        /** Maximum keys tracked per state map — prevents unbounded memory growth. */
        private const val MAX_TRACKED_ENTRIES = 1_000

        val DEFAULT_SUSPICIOUS_KEYWORDS = listOf(
            "free", "guest", "public", "open", "hack", "evil", "pineapple",
            "starbucks", "airport", "hotel", "setup", "karma", "rogue", "pentest", "kali",
        )
    }

    /** Deauth threshold (can be overridden in tests or settings). */
    var deauthThreshold: Int = DEFAULT_DEAUTH_THRESHOLD
}
