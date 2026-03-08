package com.wifisentry.core

import android.content.Context
import android.os.IBinder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import rikka.shizuku.Shizuku
import rikka.shizuku.ShizukuBinderWrapper
import rikka.shizuku.SystemServiceHelper

/**
 * ShizukuWifiScanner — Scanner tier 2 in the privilege escalation chain.
 *
 * Uses the Shizuku framework (https://github.com/RikkaApps/Shizuku) to execute
 * commands under the ADB shell context (Linux UID 2000), bypassing Android 10+
 * Wi-Fi scan throttling (4 scans per 2 minutes) that affects the standard
 * [WifiScanner] tier.
 *
 * ## Architecture
 * Shizuku wraps a privileged Binder service that runs in the system_server process
 * space.  [ShizukuBinderWrapper] proxies calls through that service, giving this
 * app ADB-level capabilities without requiring a full root environment.
 *
 * Privilege fallback order (matches the overall scanner chain):
 * 1. Shizuku (this class) — ADB shell UID 2000
 * 2. Root shell (`su -c`) — handled by [RootShellScanner]
 * 3. Standard WifiManager — handled by [WifiScanner]
 *
 * ## Usage
 * ```kotlin
 * val shizukuScanner = ShizukuWifiScanner(context)
 * if (shizukuScanner.isAvailable()) {
 *     val data = shizukuScanner.scan()  // IO dispatcher — safe to call from coroutine
 * }
 * ```
 *
 * @param context  Application context used for permission checks.
 * @param wifiInterface  Managed-mode Wi-Fi interface name (default `wlan0`).
 * @param monitorInterface  Virtual monitor interface to create (default `mon0`).
 * @param captureDurationSeconds  Seconds to capture frames per scan window.
 */
class ShizukuWifiScanner(
    private val context: Context,
    private val wifiInterface: String = "wlan0",
    private val monitorInterface: String = "mon0",
    private val captureDurationSeconds: Int = DEFAULT_CAPTURE_DURATION_S,
) {

    // ── Availability checks ───────────────────────────────────────────────

    /**
     * Returns true when the Shizuku service is running and the app has been
     * granted permission to use it.
     *
     * Must be checked on the calling thread; does NOT trigger a permission
     * request — call [requestPermissionIfNeeded] separately from the UI.
     */
    fun isAvailable(): Boolean = try {
        Shizuku.pingBinder() && checkPermissionGranted()
    } catch (_: Exception) {
        false
    }

    /**
     * Returns the Linux UID under which Shizuku commands will execute.
     * ADB shell = 2000, root = 0; returns -1 when Shizuku is not running.
     */
    fun getShizukuUid(): Int = try {
        if (Shizuku.pingBinder()) Shizuku.getUid() else -1
    } catch (_: Exception) {
        -1
    }

    /**
     * Returns true when the Shizuku UID is the ADB shell UID (2000).
     * Root mode (UID 0) also supports all needed operations.
     */
    fun isAdbShell(): Boolean {
        val uid = getShizukuUid()
        return uid == ADB_SHELL_UID || uid == ROOT_UID
    }

    // ── Permission management ─────────────────────────────────────────────

    /**
     * Requests Shizuku permission if it has not been granted yet.
     * Must be called from the UI thread so Android can show the permission
     * dialog provided by the Shizuku app.
     *
     * @param requestCode  Integer request code passed back to [Shizuku.OnRequestPermissionResultListener].
     */
    fun requestPermissionIfNeeded(requestCode: Int = DEFAULT_PERMISSION_REQUEST_CODE) {
        if (!checkPermissionGranted()) {
            try {
                Shizuku.requestPermission(requestCode)
            } catch (_: Exception) {
                // Shizuku not running — permission dialog cannot be shown
            }
        }
    }

    // ── Scan operations ───────────────────────────────────────────────────

    /**
     * Execute a privileged packet-capture scan using Shizuku.
     *
     * All I/O work is performed on [Dispatchers.IO]; this function is safe to
     * call from any coroutine scope.
     *
     * Returns a [RootScanData] with `rootActive = false` when:
     * - Shizuku is not available or permission is denied
     * - Required system tools (`iw`, `tcpdump`) are not found
     * - Any exception occurs during capture (monitor interface is cleaned up)
     */
    suspend fun scan(): RootScanData = withContext(Dispatchers.IO) {
        if (!isAvailable()) return@withContext RootScanData()
        if (!isToolAvailable("iw") || !isToolAvailable("tcpdump")) return@withContext RootScanData()

        try {
            setupMonitorMode()
            val deauthCount    = captureDeauthFrames()
            val probeOnlySsids = captureProbeOnlySsids()
            tearDownMonitorMode()

            RootScanData(
                deauthFrameCount = deauthCount,
                probeOnlySsids   = probeOnlySsids,
                rootActive       = true,
            )
        } catch (_: Exception) {
            tryTearDownMonitorMode()
            RootScanData()
        }
    }

    /**
     * Execute a single raw shell command via Shizuku and return stdout.
     *
     * Uses [ShizukuBinderWrapper] to obtain a reference to the system's
     * `ISuperUser` service, then forks a new process under the Shizuku UID.
     * Falls back to a direct [ProcessBuilder] exec via `sh -c` when
     * Shizuku's [ShizukuBinderWrapper] is unavailable for the specific command
     * (e.g. commands that don't require Binder-level IPC).
     *
     * All execution is done on the calling thread — call from [Dispatchers.IO].
     *
     * @param command  The shell command string to execute (passed to `sh -c`).
     * @return  Combined stdout output of the command, or empty string on error.
     */
    fun execShizukuCommand(command: String): String {
        return try {
            // Prefer Shizuku's newProcess() which runs under the Shizuku UID
            val process = Shizuku.newProcess(arrayOf("sh", "-c", command), null, null)
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            output
        } catch (_: Exception) {
            // Fallback: obtain a raw Binder from the system service and exec directly.
            // This covers edge cases where newProcess() is restricted on older Shizuku.
            execViaBinderWrapper(command)
        }
    }

    // ── Monitor mode lifecycle ────────────────────────────────────────────

    private fun setupMonitorMode() {
        execShizukuCommand("iw dev $wifiInterface interface add $monitorInterface type monitor")
        execShizukuCommand("ip link set $monitorInterface up")
    }

    private fun tearDownMonitorMode() {
        execShizukuCommand("ip link set $monitorInterface down")
        execShizukuCommand("iw dev $monitorInterface del")
    }

    private fun tryTearDownMonitorMode() {
        try { tearDownMonitorMode() } catch (_: Exception) {}
    }

    // ── Packet capture ────────────────────────────────────────────────────

    /**
     * Count 802.11 deauth + disassociation frames captured during
     * [captureDurationSeconds] seconds on the monitor interface.
     */
    private fun captureDeauthFrames(): Int {
        val output = execShizukuCommand(
            "timeout $captureDurationSeconds" +
            " tcpdump -I -i $monitorInterface --immediate-mode -q" +
            " 'wlan type mgt subtype deauth or wlan type mgt subtype disassoc'" +
            " 2>/dev/null | wc -l"
        )
        return output.trim().toIntOrNull() ?: 0
    }

    /**
     * Collect SSIDs that appear in probe-response frames but are absent from
     * every beacon frame in the same capture window (Karma attack signature).
     *
     * Returns an empty set when `tshark` is not available.
     */
    private fun captureProbeOnlySsids(): Set<String> {
        if (!isToolAvailable("tshark")) return emptySet()

        val rawOutput = execShizukuCommand(
            "timeout $captureDurationSeconds" +
            " tshark -I -i $monitorInterface" +
            " -Y 'wlan.fc.type_subtype == 5 or wlan.fc.type_subtype == 8'" +
            " -T fields -e wlan.fc.type_subtype -e wlan_mgt.ssid" +
            " 2>/dev/null"
        )
        if (rawOutput.isBlank()) return emptySet()

        val beaconSsids    = mutableSetOf<String>()
        val probeRespSsids = mutableSetOf<String>()

        for (line in rawOutput.lines()) {
            val parts = line.trim().split("\t")
            if (parts.size < 2) continue
            val ssid = parts[1].trim()
            if (ssid.isBlank()) continue
            when (parts[0].trim()) {
                "8"  -> beaconSsids    += ssid
                "5"  -> probeRespSsids += ssid
            }
        }

        return probeRespSsids - beaconSsids
    }

    // ── Binder wrapper fallback ───────────────────────────────────────────

    /**
     * Attempt to execute [command] using a direct `sh -c` ProcessBuilder call
     * via the Shizuku Binder reference.
     *
     * **Note:** This path does NOT elevate the process's Linux UID. Wrapping
     * the shell service Binder through [ShizukuBinderWrapper] obtains a token
     * but cannot transfer privilege to a child process.  This fallback is only
     * invoked when [Shizuku.newProcess] is unavailable (older Shizuku < 12) and
     * will execute under the app's own UID.  It is kept here for completeness
     * but the primary path ([execShizukuCommand]) always prefers [Shizuku.newProcess].
     */
    private fun execViaBinderWrapper(command: String): String {
        return try {
            // Obtain a Binder reference through Shizuku to confirm the service is
            // alive before falling back to a standard ProcessBuilder.
            val shellBinder: IBinder = ShizukuBinderWrapper(
                SystemServiceHelper.getSystemService("shell")
            )
            if (shellBinder.isBinderAlive) {
                val process = ProcessBuilder("sh", "-c", command)
                    .redirectErrorStream(true)
                    .start()
                val output = process.inputStream.bufferedReader().readText()
                process.waitFor()
                output
            } else {
                ""
            }
        } catch (_: Exception) {
            ""
        }
    }

    // ── Tool availability ─────────────────────────────────────────────────

    private val toolCache = mutableMapOf<String, Boolean>()

    private fun isToolAvailable(tool: String): Boolean {
        return toolCache.getOrPut(tool) {
            try {
                val output = execShizukuCommand("which $tool")
                output.trim().isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }
    }

    // ── Permission helper ─────────────────────────────────────────────────

    private fun checkPermissionGranted(): Boolean = try {
        when {
            Shizuku.isPreV11() -> false
            else               -> Shizuku.checkSelfPermission() == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
    } catch (_: Exception) {
        false
    }

    // ── Constants ─────────────────────────────────────────────────────────

    companion object {
        /** ADB shell Linux UID. */
        const val ADB_SHELL_UID = 2000

        /** Root Linux UID. */
        const val ROOT_UID = 0

        /** Default seconds to capture frames per scan window. */
        private const val DEFAULT_CAPTURE_DURATION_S = 5

        /** Default permission request code for [requestPermissionIfNeeded]. */
        const val DEFAULT_PERMISSION_REQUEST_CODE = 0x5A19_0001
    }
}
