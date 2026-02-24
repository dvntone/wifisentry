package com.wifisentry.core

/**
 * Performs enhanced Wi-Fi scanning using root shell commands.
 *
 * All public methods return safe empty/default values on non-rooted devices or
 * when the required system tools are not installed.  The calling code never
 * needs to branch on root availability — it always receives a [RootScanData]
 * and the [RootScanData.rootActive] flag indicates whether privileged data was
 * actually collected.
 *
 * Required system tools (install via a root-capable package manager such as
 * Termux with root, or the device's built-in busybox):
 *   - `iw`       — wireless interface management (monitor mode setup)
 *   - `tcpdump`  — packet capture for deauth frame counting
 *   - `tshark`   — optional; used for probe-response SSID extraction
 *
 * @param wifiInterface     managed-mode interface name (default `wlan0`)
 * @param monitorInterface  virtual monitor interface to create (default `mon0`)
 * @param captureDurationSeconds  seconds to capture frames per scan window
 */
class RootShellScanner(
    private val wifiInterface: String = "wlan0",
    private val monitorInterface: String = "mon0",
    private val captureDurationSeconds: Int = CAPTURE_DURATION_S,
) {

    /**
     * Run a root-enhanced scan and return the aggregated [RootScanData].
     *
     * Returns an empty [RootScanData] (rootActive = false) when:
     * - The device is not rooted
     * - Required tools (`iw`, `tcpdump`) are not available
     * - Any error occurs during capture (monitor mode is cleaned up)
     */
    fun scan(): RootScanData {
        if (!RootChecker.isRooted) return RootScanData()
        if (!isToolAvailable("iw") || !isToolAvailable("tcpdump")) return RootScanData()

        return try {
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

    // ── monitor mode lifecycle ─────────────────────────────────────────────

    private fun setupMonitorMode() {
        su("iw dev $wifiInterface interface add $monitorInterface type monitor")
        su("ip link set $monitorInterface up")
    }

    private fun tearDownMonitorMode() {
        su("ip link set $monitorInterface down")
        su("iw dev $monitorInterface del")
    }

    private fun tryTearDownMonitorMode() {
        try { tearDownMonitorMode() } catch (_: Exception) {}
    }

    // ── packet capture ─────────────────────────────────────────────────────

    /**
     * Count 802.11 deauthentication + disassociation frames captured during
     * [captureDurationSeconds] seconds on the monitor interface.
     *
     * High counts indicate a deauth flood attack — an attacker is forcibly
     * disconnecting clients so they reconnect to a rogue clone.
     */
    private fun captureDeauthFrames(): Int {
        val output = su(
            "timeout $captureDurationSeconds" +
            " tcpdump -I -i $monitorInterface --immediate-mode -q" +
            " 'wlan type mgt subtype deauth or wlan type mgt subtype disassoc'" +
            " 2>/dev/null | wc -l"
        )
        return output.trim().toIntOrNull() ?: 0
    }

    /**
     * Collect SSIDs that appear in probe-response frames but are absent from
     * every beacon frame in the same capture window.
     *
     * Karma / Pineapple rogue devices answer every probe request with a
     * matching response but never send unsolicited beacons — so these SSIDs
     * are visible only in probe-responses, never in beacons.
     *
     * Returns an empty set when `tshark` is not available.
     */
    private fun captureProbeOnlySsids(): Set<String> {
        if (!isToolAvailable("tshark")) return emptySet()

        // Capture beacon (subtype 0x08) and probe-response (subtype 0x05) frames.
        // Output two tab-separated columns: frame subtype decimal, SSID string.
        val rawOutput = su(
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
                "8"  -> beaconSsids    += ssid   // beacon
                "5"  -> probeRespSsids += ssid   // probe-response
            }
        }

        return probeRespSsids - beaconSsids
    }

    // ── shell helpers ──────────────────────────────────────────────────────

    /** Execute [command] via `su -c` and return stdout. Returns "" on error. */
    private fun su(command: String): String = try {
        val process = ProcessBuilder("su", "-c", command)
            .redirectErrorStream(true)
            .start()
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        output
    } catch (_: Exception) { "" }

    private fun isToolAvailable(tool: String): Boolean = try {
        val p = ProcessBuilder("which", tool).redirectErrorStream(true).start()
        val out = p.inputStream.bufferedReader().readText().trim()
        p.waitFor()
        out.isNotEmpty()
    } catch (_: Exception) { false }

    companion object {
        /** Seconds to capture frames per scan window. */
        private const val CAPTURE_DURATION_S = 5

        /** Deauth frames per capture window above which [ThreatType.DEAUTH_FLOOD] is flagged. */
        const val DEAUTH_FLOOD_THRESHOLD = 10
    }
}
