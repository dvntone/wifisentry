package com.wifisentry.app

import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.content.Context
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.toScannedNetwork
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import rikka.shizuku.Shizuku

/**
 * ShizukuWifiScanner — Tier-2 scanner in the scanner priority chain.
 *
 * Uses the Shizuku framework to obtain ADB-shell-level privileges (Linux UID 2000),
 * which bypasses the Android 10+ 4-scans/2-min throttle that the standard
 * [WifiManager] API imposes on foreground apps.
 *
 * ## Availability
 * This scanner is an **optional** tier, controlled by [BuildConfig.SHIZUKU_ENABLED].
 * - `false` (default / Play Store builds): all methods return safe empty values
 *   immediately without loading any Shizuku classes.
 * - `true` (developer / red-team builds): Shizuku is exercised at runtime.
 *
 * The class is safe to instantiate regardless of whether Shizuku is installed.
 * Call [isAvailable] before using scan results; when it returns `false` the
 * scanner chain must fall through to the next tier.
 *
 * ## Threading
 * [startScan] and [getLatestResults] MUST be called from a background thread
 * or a coroutine scope running on [Dispatchers.IO].  The Shizuku binder call
 * may block for several milliseconds.
 *
 * ## IPC hardening
 * All shell commands are passed as an argument array to [Shizuku.newProcess],
 * never as a concatenated string, to prevent shell-injection attacks
 * (see OWASP MASVS-CODE-4).
 */
class ShizukuWifiScanner(private val context: Context) {

    private val wifiManager: WifiManager? =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    // ── availability ──────────────────────────────────────────────────────

    /**
     * Returns `true` when:
     * 1. [BuildConfig.SHIZUKU_ENABLED] is `true` (build-time gate).
     * 2. The Shizuku binder is alive (Shizuku app is running).
     * 3. The runtime permission for this app has been granted.
     *
     * Safe to call from any thread.
     */
    fun isAvailable(): Boolean {
        if (!BuildConfig.SHIZUKU_ENABLED) return false
        return try {
            Shizuku.pingBinder() &&
                Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Requests the Shizuku runtime permission if it has not been granted yet.
     * Displays the system permission dialog — must be called from the **main thread**.
     *
     * The result is delivered asynchronously to any listener registered via
     * [Shizuku.addRequestPermissionResultListener].
     *
     * @param requestCode arbitrary request code passed back in the result callback.
     */
    fun requestPermissionIfNeeded(requestCode: Int) {
        if (!BuildConfig.SHIZUKU_ENABLED) return
        try {
            if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                Shizuku.requestPermission(requestCode)
            }
        } catch (_: Exception) {
            // Shizuku not installed or binder not ready — ignore silently
        }
    }

    // ── scanning ──────────────────────────────────────────────────────────

    /**
     * Initiates a Wi-Fi scan under ADB-shell privileges via Shizuku, bypassing
     * the scan throttle.
     *
     * Strategy:
     * 1. Run `cmd wifi scan-request` via [Shizuku.newProcess] (preferred — no throttle).
     * 2. If that call fails, fall back to [WifiManager.startScan] (may still throttle).
     *
     * Returns `true` when a scan was successfully initiated; `false` when
     * Shizuku is unavailable or both attempts fail.
     *
     * **Must NOT be called on the main thread.**
     */
    @Suppress("DEPRECATION")
    suspend fun startScan(): Boolean = withContext(Dispatchers.IO) {
        if (!isAvailable()) return@withContext false
        val wm = wifiManager ?: return@withContext false

        // Primary: ADB-level scan request — not subject to throttling
        val exitCode = runShizukuCommand("cmd", "wifi", "scan-request")
        if (exitCode == 0) return@withContext true

        // Fallback: WifiManager (may still be throttled on Android 10+)
        return@withContext try {
            wm.startScan()
        } catch (_: SecurityException) {
            false
        }
    }

    /**
     * Returns the most-recently cached scan results from [WifiManager].
     *
     * A scan must have been initiated via [startScan] (or any other means)
     * before this will return non-empty results.  Returns an empty list when
     * Shizuku is unavailable or the permission has been revoked.
     *
     * **Must NOT be called on the main thread.**
     */
    suspend fun getLatestResults(): List<ScannedNetwork> = withContext(Dispatchers.IO) {
        if (!isAvailable()) return@withContext emptyList()
        return@withContext try {
            wifiManager?.scanResults?.map { it.toScannedNetwork() } ?: emptyList()
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    // ── private helpers ───────────────────────────────────────────────────

    /**
     * Runs a command under the ADB-shell UID via the Shizuku binder.
     *
     * Arguments are passed as an **array** (never a joined string) to prevent
     * shell injection.  Returns the process exit code, or -1 on any error.
     */
    private fun runShizukuCommand(vararg args: String): Int {
        return try {
            val process = Shizuku.newProcess(args, null, null)
            process.waitFor()
        } catch (_: Exception) {
            -1
        }
    }
}
