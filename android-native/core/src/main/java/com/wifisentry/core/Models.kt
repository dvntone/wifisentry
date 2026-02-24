package com.wifisentry.core

import android.net.wifi.ScanResult

// Wi-Fi standard constants — mirror android.net.wifi.ScanResult.WIFI_STANDARD_* values so
// that the core module's JVM unit tests can reference them without the Android framework.
const val WIFI_STANDARD_UNKNOWN = 0
const val WIFI_STANDARD_LEGACY  = 1  // 802.11a/b/g
const val WIFI_STANDARD_11N     = 4  // Wi-Fi 4  (2.4 GHz and 5 GHz)
const val WIFI_STANDARD_11AC    = 5  // Wi-Fi 5  (5 GHz only)
const val WIFI_STANDARD_11AX    = 6  // Wi-Fi 6 / 6E  (2.4, 5, and 6 GHz)
const val WIFI_STANDARD_11BE    = 8  // Wi-Fi 7  (2.4, 5, and 6 GHz)

/**
 * Represents a single scanned Wi-Fi network with threat analysis results.
 *
 * GPS fields use [Double.NaN] as a sentinel for "no fix available" so that
 * old serialised records (which lack these fields) deserialise cleanly.
 * Check [hasGpsFix] before using [latitude] / [longitude].
 */
data class ScannedNetwork(
    val ssid: String,
    val bssid: String,
    val capabilities: String,
    val rssi: Int,
    val frequency: Int,
    val timestamp: Long,
    val wifiStandard: Int = WIFI_STANDARD_UNKNOWN,
    val threats: List<ThreatType> = emptyList(),
    /** WGS-84 latitude in decimal degrees, or [Double.NaN] when no GPS fix was available. */
    val latitude: Double = Double.NaN,
    /** WGS-84 longitude in decimal degrees, or [Double.NaN] when no GPS fix was available. */
    val longitude: Double = Double.NaN,
    /** Altitude above sea level in metres, or [Double.NaN] when not available. */
    val altitude: Double = Double.NaN,
    /** Horizontal accuracy radius in metres, or [Float.NaN] when not available. */
    val gpsAccuracy: Float = Float.NaN,
) {
    val isFlagged: Boolean get() = threats.isNotEmpty()
    val isOpen: Boolean get() = !capabilities.contains("WPA") && !capabilities.contains("WEP") && !capabilities.contains("SAE")
    /** True when a valid GPS fix is stored on this record. */
    val hasGpsFix: Boolean get() = latitude.isFinite() && longitude.isFinite()
    /**
     * The highest (most severe) [ThreatSeverity] across all detected threats,
     * or null when the network is not flagged.
     */
    val highestSeverity: ThreatSeverity?
        get() = threats.map { it.severity }.minByOrNull { it.ordinal }
}

/**
 * Aggregated scan statistics shown in the stats panel.
 */
data class ScanStats(
    /** Networks found in the most-recent one-shot scan (or current monitoring batch). */
    val totalThisScan: Int = 0,
    /** Flagged networks in the most-recent scan. */
    val threatsThisScan: Int = 0,
    /** Unique networks accumulated across the current monitoring session. */
    val sessionUnique: Int = 0,
    /** Flagged networks in the current session. */
    val sessionThreats: Int = 0,
    /** Total networks stored across all scan history. */
    val totalAllTime: Int = 0,
    /** Total flagged networks stored across all scan history. */
    val threatsAllTime: Int = 0,
)

/**
 * Severity level assigned to each [ThreatType].
 * Used for colour-coding list items: HIGH = red, MEDIUM = orange, LOW = amber.
 */
enum class ThreatSeverity { HIGH, MEDIUM, LOW }

/** The severity associated with this threat type. */
val ThreatType.severity: ThreatSeverity
    get() = when (this) {
        ThreatType.EVIL_TWIN,
        ThreatType.DEAUTH_FLOOD,
        ThreatType.PROBE_RESPONSE_ANOMALY,
        ThreatType.BEACON_FLOOD,
        ThreatType.INCONSISTENT_CAPABILITIES -> ThreatSeverity.HIGH

        ThreatType.OPEN_NETWORK,
        ThreatType.SECURITY_CHANGE,
        ThreatType.MAC_SPOOFING_SUSPECTED,
        ThreatType.MULTI_SSID_SAME_OUI,
        ThreatType.BSSID_NEAR_CLONE,
        ThreatType.SUSPICIOUS_SIGNAL_STRENGTH,
        ThreatType.CHANNEL_SHIFT -> ThreatSeverity.MEDIUM

        ThreatType.WPS_VULNERABLE,
        ThreatType.MULTIPLE_BSSIDS,
        ThreatType.SUSPICIOUS_SSID -> ThreatSeverity.LOW
    }

/**
 * Types of threats that can be detected for a Wi-Fi network.
 */
enum class ThreatType {
    OPEN_NETWORK,
    SUSPICIOUS_SSID,
    MULTIPLE_BSSIDS,
    SECURITY_CHANGE,
    /** Open AP whose SSID was previously observed as secured, appearing with a new BSSID.
     *  Classic evil-twin / Wi-Fi Pineapple impersonation pattern. */
    EVIL_TWIN,
    /** BSSID has the locally-administered bit set — not a real manufacturer MAC.
     *  Legitimate APs always use globally-administered (OUI-registered) MACs; a
     *  software-defined or spoofed MAC is a strong rogue-AP indicator. */
    MAC_SPOOFING_SUSPECTED,
    /** Previously-unseen BSSID advertising with an unusually strong signal while
     *  established scan history exists.  Consistent with a rogue device (e.g. a
     *  Wi-Fi Pineapple) being physically co-located with the user. */
    SUSPICIOUS_SIGNAL_STRENGTH,
    /** Five or more distinct SSIDs are being advertised by APs that share the same
     *  hardware OUI (first three BSSID octets).  A single legitimate router may
     *  have 2–4 virtual SSIDs; five or more from the same OUI in one scan is a
     *  strong indicator of a Pineapple running Karma mode or Wi-Fi Marauder's
     *  beacon-spam SSID list. */
    MULTI_SSID_SAME_OUI,
    /** Four or more brand-new BSSIDs sharing the same OUI have appeared in a
     *  single scan that were absent from all prior scan history.  This matches
     *  the sudden-flood signature of Wi-Fi Marauder's "spam ap list" command,
     *  where one ESP32 radio rapidly creates dozens of virtual APs.
     *  Requires at least one prior scan as a baseline; first-scan events are
     *  not flagged to avoid false positives in new environments. */
    BEACON_FLOOD,
    /** The AP's advertised Wi-Fi standard is physically incompatible with its
     *  operating frequency.  Two rules apply:
     *  • 802.11ac (Wi-Fi 5) is a 5 GHz–only standard; it cannot legitimately
     *    appear in a 2.4 GHz beacon.
     *  • The 6 GHz band (5925–7125 MHz, Wi-Fi 6E/7) cannot carry a pre–Wi-Fi 6
     *    standard.
     *  Both mismatches are physically impossible on real hardware and indicate a
     *  software-defined rogue AP fabricating its capability advertisement. */
    INCONSISTENT_CAPABILITIES,
    /** An AP shares the same SSID as another AP in the scan and its BSSID differs
     *  only in the last one or two octets — the first four octets are identical.
     *  Legitimate dual-band routers assign sequential MACs across bands (e.g.
     *  5f:5f:f4:66:aa on 2.4 GHz and 5f:5f:f4:66:ab on 5 GHz), so the pattern
     *  itself is not suspicious.  It becomes suspicious when:
     *  • Both near-identical BSSIDs are on the same frequency band — a real
     *    dual-band router always uses different bands for each radio; same-band
     *    near-clones mean one is a rogue copy.
     *  • The near-clone BSSID is brand-new (not seen in any prior scan) while
     *    the matching SSID + near-identical BSSID was already known — consistent
     *    with an attacker inserting a rogue AP alongside a legitimate one. */
    BSSID_NEAR_CLONE,

    // ── detectable without root, from WifiManager ScanResult data ─────────

    /** AP advertises WPS (Wi-Fi Protected Setup) in its capabilities string.
     *  WPS PIN mode is vulnerable to offline brute-force (Pixie Dust, Reaver).
     *  Detectable without root from [android.net.wifi.ScanResult.capabilities]
     *  which includes "[WPS]" when WPS is active. */
    WPS_VULNERABLE,

    /** This BSSID was previously observed on a different frequency band (e.g.
     *  2.4 GHz → 5 GHz or vice versa).  Legitimate APs stay on their assigned
     *  band; a sudden band change for a known BSSID is consistent with a rogue
     *  device impersonating the AP from a different radio.
     *  Detectable without root using frequency data from [android.net.wifi.ScanResult]. */
    CHANNEL_SHIFT,

    // ── root + monitor mode required ──────────────────────────────────────

    /** An elevated number of 802.11 deauthentication / disassociation frames
     *  was captured during continuous monitoring in monitor mode.  Deauth
     *  floods forcibly disconnect clients from a legitimate AP so they
     *  reconnect to a rogue clone.
     *  Requires root + a WiFi adapter that supports monitor mode. */
    DEAUTH_FLOOD,

    /** An SSID was seen in a captured probe-response frame but is absent from
     *  every beacon in the current scan.  This is the defining Karma / Pineapple
     *  signature: the rogue device answers client probe requests for any SSID
     *  but never spontaneously beacons for those SSIDs itself.
     *  Requires root + monitor mode + tshark. */
    PROBE_RESPONSE_ANOMALY
}

/**
 * A timestamped record of a complete Wi-Fi scan.
 */
data class ScanRecord(
    val timestampMs: Long,
    val networks: List<ScannedNetwork>
)

fun ScanResult.toScannedNetwork(threats: List<ThreatType> = emptyList()): ScannedNetwork {
    @Suppress("DEPRECATION")
    val ssidStr = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
        wifiSsid?.toString()?.trim('"') ?: SSID ?: ""
    } else {
        SSID ?: ""
    }
    return ScannedNetwork(
        ssid = ssidStr,
        bssid = BSSID ?: "",
        capabilities = capabilities ?: "",
        rssi = level,
        frequency = frequency,
        timestamp = timestamp,
        wifiStandard = wifiStandard
    )
}

/**
 * Category of change detected between two observations of the same AP.
 *
 * Detection design is informed by:
 * - Flock-You-Android (MaxwellDPS) WifiDetectionHandler + THREAT_SCORING_FRAMEWORK
 * - Kismet WIDS alert system (evil-twin, deauth, capability-change alerts)
 * - Stock Android feasibility analysis: all of these are detectable via
 *   WifiManager.getScanResults() without root or monitor mode.
 */
enum class ChangeType {
    /** Security protocol dropped to a weaker scheme (e.g. WPA2 → WPA or → Open).
     *  Classic downgrade-attack / evil-twin setup indicator. */
    SECURITY_DOWNGRADE,
    /** Security protocol improved (e.g. Open → WPA2).  Not a threat but notable. */
    SECURITY_UPGRADE,
    /** BSSID moved to a different Wi-Fi channel or band between scans.
     *  Legitimate APs stay on their assigned channel; a change is suspicious. */
    CHANNEL_SHIFT,
    /** A new BSSID is broadcasting a previously-known SSID.
     *  The most common evil-twin indicator on stock Android. */
    NEW_BSSID_SAME_SSID,
    /** RSSI changed by more than [ChangeAnalyzer.RSSI_ANOMALY_DBM] dBm between
     *  consecutive scans.  Consistent with a moving rogue AP or sudden physical change. */
    SIGNAL_ANOMALY,
    /** The capabilities string changed significantly (different security suite,
     *  WPS appeared/disappeared, cipher changed). */
    CAPABILITIES_CHANGED,
    /** This BSSID has been seen at multiple geographically distinct locations,
     *  suggesting it is a mobile device following the user — the "following network"
     *  attack documented by Flock-You-Android. */
    FOLLOWING_NETWORK,
}

/**
 * A single detected change in an AP's characteristics across two scan records.
 *
 * The [description] field is intentionally formatted as a Gemini-ready prompt
 * fragment: it states the facts, context, and previous/current values so that an
 * LLM can generate a natural-language threat explanation without needing the raw
 * data objects.
 *
 * Scoring uses the formula: `score = (baseLikelihood * impactFactor * confidence).toInt()`
 * modelled after the Flock-You Android threat scoring framework.  Score ≥ 70 → HIGH,
 * ≥ 40 → MEDIUM, ≥ 10 → LOW, < 10 is suppressed as a likely false positive.
 *
 * ## Gemini AI integration note
 * When a Gemini API key is configured (see GEMINI.md), pass each [NetworkChange]
 * to the Gemini API with a prompt like:
 *   "A Wi-Fi access point '[ssid]' ([bssid]) has the following change: [description].
 *    Threat score: [score]/100. Explain whether this is a genuine security threat and
 *    what the user should do."
 * The [ChangeAnalyzer] is intentionally decoupled so a GeminiAnalysisEngine wrapper
 * can call it first, then enrich each finding with AI-generated remediation text.
 * YES — Google Gemini AI absolutely works for this use-case.
 */
data class NetworkChange(
    val ssid: String,
    val bssid: String,
    val type: ChangeType,
    val previousValue: String,
    val currentValue: String,
    /** Human-readable change description, pre-formatted as a Gemini prompt fragment. */
    val description: String,
    val detectedAtMs: Long = System.currentTimeMillis(),
    /** Calibrated 0–100 threat score (likelihood × impact × confidence). */
    val score: Int,
    val severity: ThreatSeverity,
)
