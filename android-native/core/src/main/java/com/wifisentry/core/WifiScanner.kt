package com.wifisentry.core

import android.content.Context
import android.net.wifi.WifiManager

/**
 * Wi-Fi scanner that wraps [WifiManager] and converts raw Android results into
 * domain objects.
 *
 * The caller is responsible for holding the required permissions before calling
 * [startScan] or [getLatestResults].
 */
class WifiScanner(context: Context) {

    private val wifiManager: WifiManager? =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    /** Returns true when Wi-Fi is enabled on the device. */
    fun isWifiEnabled(): Boolean = wifiManager?.isWifiEnabled == true

    /**
     * Request a new Wi-Fi scan.
     *
     * On Android 9+ the system rate-limits scan requests from the foreground.
     * Returns `false` if the scan could not be initiated (Wi-Fi off, or
     * throttled, or WifiManager unavailable).
     */
    @Suppress("DEPRECATION")
    fun startScan(): Boolean {
        val wm = wifiManager ?: return false
        if (!wm.isWifiEnabled) return false
        return try {
            wm.startScan()
        } catch (e: SecurityException) {
            false
        }
    }

    /**
     * Returns the most recently cached scan results from [WifiManager].
     *
     * May return an empty list when:
     * - WifiManager is unavailable (restricted environment).
     * - Location permission is not granted.
     * - Location services are disabled.
     * - No scan has been performed yet.
     * - Scan throttling applied.
     */
    @Suppress("DEPRECATION")
    fun getLatestResults(): List<ScannedNetwork> {
        return try {
            wifiManager?.scanResults?.map { it.toScannedNetwork() } ?: emptyList()
        } catch (e: SecurityException) {
            emptyList()
        }
    }
}
