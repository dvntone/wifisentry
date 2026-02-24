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
            if (isMacSpoofingSuspected(network)) {
                threats += ThreatType.MAC_SPOOFING_SUSPECTED
            }
            if (isSuspiciousSignalStrength(network, history)) {
                threats += ThreatType.SUSPICIOUS_SIGNAL_STRENGTH
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
     * bit 1 = 1, mask 0x02).
     *
     * Every legitimate Wi-Fi AP ships with a globally-administered MAC address
     * assigned by its manufacturer.  A locally-administered BSSID indicates a
     * software-defined radio, a virtualised AP, or a deliberately spoofed MAC —
     * all common in rogue-AP and evil-twin toolkits.
     */
    private fun isMacSpoofingSuspected(network: ScannedNetwork): Boolean {
        // toIntOrNull(16) parses the hex octet string (e.g. "02") as base-16 without a "0x" prefix.
        val firstOctet = network.bssid.split(":").firstOrNull()?.toIntOrNull(16) ?: return false
        // Bit 1 (second-least-significant bit, mask 0x02) is the locally-administered flag.
        return (firstOctet and 0x02) != 0
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
        history: List<ScanRecord>
    ): Boolean {
        if (history.isEmpty()) return false
        if (network.rssi < SUSPICIOUS_RSSI_THRESHOLD) return false
        val knownBssids = history.flatMap { it.networks }.map { it.bssid }.toSet()
        return network.bssid.isNotBlank() && network.bssid !in knownBssids
    }

    companion object {
        private const val DEFAULT_RECENT_WINDOW_MS = 10L * 60 * 1000 // 10 minutes

        /** dBm above which a brand-new BSSID is considered suspiciously close. */
        private const val SUSPICIOUS_RSSI_THRESHOLD = -40  // dBm

        val DEFAULT_SUSPICIOUS_KEYWORDS = listOf(
            "free", "guest", "public", "open", "hack", "evil", "pineapple",
            "test", "starbucks", "airport", "hotel", "setup",
            "karma", "rogue", "probe", "pentest", "kali"
        )
    }
}
