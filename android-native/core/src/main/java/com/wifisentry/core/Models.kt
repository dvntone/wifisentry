package com.wifisentry.core

import android.net.wifi.ScanResult

/**
 * Represents a single scanned Wi-Fi network with threat analysis results.
 */
data class ScannedNetwork(
    val ssid: String,
    val bssid: String,
    val capabilities: String,
    val rssi: Int,
    val frequency: Int,
    val timestamp: Long,
    val threats: List<ThreatType> = emptyList()
) {
    val isFlagged: Boolean get() = threats.isNotEmpty()
    val isOpen: Boolean get() = !capabilities.contains("WPA") && !capabilities.contains("WEP") && !capabilities.contains("SAE")
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
    SUSPICIOUS_SIGNAL_STRENGTH
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
        timestamp = timestamp
    )
}
