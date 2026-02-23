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
    val isOpen: Boolean get() = !capabilities.contains("WPA") && !capabilities.contains("WEP")
}

/**
 * Types of threats that can be detected for a Wi-Fi network.
 */
enum class ThreatType {
    OPEN_NETWORK,
    SUSPICIOUS_SSID,
    MULTIPLE_BSSIDS,
    SECURITY_CHANGE
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
