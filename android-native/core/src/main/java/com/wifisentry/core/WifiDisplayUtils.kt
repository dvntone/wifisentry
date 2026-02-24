package com.wifisentry.core

import kotlin.math.pow

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
    // ── Distance estimation ───────────────────────────────────────────────

    /**
     * Estimate the approximate distance in metres from a device to an AP using
     * the log-distance path-loss model:
     *
     *   distance = 10 ^ ((txPower − rssi) / 20)
     *
     * where [txPower] is the empirical RSSI at 1 m for each band:
     *  • 2.4 GHz → −59 dBm (802.11b/g/n typical 1 m value)
     *  • 5 GHz   → −65 dBm (802.11a/n/ac typical 1 m value)
     *  • 6 GHz   → −68 dBm (802.11ax/be typical 1 m value)
     *
     * The result is a rough indicator only (±50 %); use for relative comparison.
     */
    fun rssiToDistanceMeters(rssi: Int, frequencyMhz: Int = 2412): Double {
        val txPower = when {
            frequencyMhz in 2400..2499 -> -59
            frequencyMhz in 4900..5924 -> -65
            frequencyMhz in 5925..7125 -> -68
            else                       -> -59
        }
        return 10.0.pow((txPower - rssi) / 20.0)
    }

    /**
     * Format an estimated distance for display.
     *
     * @param meters   Distance in metres as returned by [rssiToDistanceMeters].
     * @param useFeet  When true, converts to feet; when false uses metres / km.
     */
    fun formatDistance(meters: Double, useFeet: Boolean): String =
        if (useFeet)            "~%.0f ft".format(meters * 3.28084)
        else if (meters < 1000) "~%.0f m".format(meters)
        else                    "~%.1f km".format(meters / 1000.0)
}

