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

    companion object {
        private const val DEFAULT_RECENT_WINDOW_MS = 10L * 60 * 1000 // 10 minutes

        val DEFAULT_SUSPICIOUS_KEYWORDS = listOf(
            "free", "guest", "public", "open", "hack", "evil", "pineapple",
            "test", "starbucks", "airport", "hotel", "setup"
        )
    }
}
