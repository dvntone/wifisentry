package com.wifisentry.core

/**
 * Pure display-formatting utilities for Wi-Fi scan data.
 *
 * All functions operate on primitives so they are fully testable without the
 * Android framework.  The values and scales used match those that
 * [android.net.wifi.WifiManager] and [android.net.wifi.ScanResult] expose.
 */
object WifiDisplayUtils {

    // ── Signal strength ───────────────────────────────────────────────────

    /**
     * Convert RSSI (dBm, typically –100 to –55) to a 0–100 percentage that
     * feels consistent with the signal bars shown in the Android status bar.
     */
    fun rssiToPercent(rssi: Int): Int {
        val min = -100
        val max = -55
        return when {
            rssi <= min -> 0
            rssi >= max -> 100
            else        -> ((rssi - min) * 100) / (max - min)
        }
    }

    /** One of four human-readable signal quality labels. */
    fun rssiToLabel(rssi: Int): String = when {
        rssi >= -55 -> "Excellent"
        rssi >= -67 -> "Good"
        rssi >= -78 -> "Fair"
        rssi >= -89 -> "Weak"
        else        -> "No signal"
    }

    // ── Frequency / band / channel ────────────────────────────────────────

    /** Band label derived from channel centre frequency in MHz. */
    fun frequencyToBand(freqMhz: Int): String = when {
        freqMhz in 2400..2499 -> "2.4 GHz"
        freqMhz in 4900..5924 -> "5 GHz"
        freqMhz in 5925..7125 -> "6 GHz"
        else                   -> ""
    }

    /**
     * Wi-Fi channel number from centre frequency in MHz.
     * Returns –1 when the frequency is not in a known Wi-Fi band.
     */
    fun frequencyToChannel(freqMhz: Int): Int = when {
        freqMhz == 2484          -> 14
        freqMhz in 2412..2472    -> (freqMhz - 2407) / 5
        freqMhz in 5160..5885    -> (freqMhz - 5000) / 5
        freqMhz in 5955..7115    -> (freqMhz - 5950) / 5
        else                     -> -1
    }

    // ── Channel width ─────────────────────────────────────────────────────

    /**
     * Human-readable channel width.
     * Inputs are [android.net.wifi.ScanResult] CHANNEL_WIDTH_* integer constants.
     * Returns an empty string for unknown/unset values (–1).
     */
    fun channelWidthLabel(channelWidth: Int): String = when (channelWidth) {
        0    -> "20 MHz"
        1    -> "40 MHz"
        2    -> "80 MHz"
        3    -> "160 MHz"
        4    -> "80+80 MHz"
        5    -> "320 MHz"   // Wi-Fi 7 (802.11be)
        else -> ""
    }

    // ── Wi-Fi standard ────────────────────────────────────────────────────

    /**
     * Human-readable Wi-Fi generation label.
     * Input values mirror [android.net.wifi.ScanResult.WIFI_STANDARD_*] and the
     * constants defined in [Models.kt].
     */
    fun wifiStandardLabel(standard: Int): String = when (standard) {
        WIFI_STANDARD_LEGACY -> "Legacy (802.11a/b/g)"
        WIFI_STANDARD_11N    -> "Wi-Fi 4 (802.11n)"
        WIFI_STANDARD_11AC   -> "Wi-Fi 5 (802.11ac)"
        WIFI_STANDARD_11AX   -> "Wi-Fi 6 / 6E (802.11ax)"
        WIFI_STANDARD_11BE   -> "Wi-Fi 7 (802.11be)"
        else                 -> ""
    }

    // ── Security ──────────────────────────────────────────────────────────

    /**
     * Friendly security label extracted from [android.net.wifi.ScanResult.capabilities].
     *
     * Priority order: WPA3-Enterprise → WPA3 (SAE) → WPA2-Enterprise → WPA2 →
     * WPA-Enterprise → WPA → WEP → Open.
     */
    fun capabilitiesToSecurityLabel(capabilities: String): String {
        val c = capabilities.uppercase()
        return when {
            c.contains("EAP-SUITE-B")              -> "WPA3-Enterprise"
            c.contains("SAE")                      -> "WPA3"
            c.contains("WPA2") || c.contains("RSN") -> if (c.contains("EAP")) "WPA2-Enterprise" else "WPA2"
            c.contains("WPA")                      -> if (c.contains("EAP")) "WPA-Enterprise"   else "WPA"
            c.contains("WEP")                      -> "WEP (insecure)"
            else                                   -> "Open"
        }
    }
}
