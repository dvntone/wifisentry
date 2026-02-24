package com.wifisentry.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.wifi.WifiManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wifisentry.core.RootChecker
import com.wifisentry.core.RootScanData
import com.wifisentry.core.RootShellScanner
import com.wifisentry.core.ScanRecord
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatAnalyzer
import com.wifisentry.core.WifiScanner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

class MainViewModel(
    private val wifiScanner: WifiScanner,
    private val threatAnalyzer: ThreatAnalyzer,
    private val storage: ScanStorage,
) : ViewModel() {

    private val _networks     = MutableLiveData<List<ScannedNetwork>>()
    val networks: LiveData<List<ScannedNetwork>> = _networks

    private val _isScanning   = MutableLiveData(false)
    val isScanning: LiveData<Boolean> = _isScanning

    private val _isMonitoring = MutableLiveData(false)
    val isMonitoring: LiveData<Boolean> = _isMonitoring

    private val _scanError    = MutableLiveData<String?>()
    val scanError: LiveData<String?> = _scanError

    private val _scanStatus   = MutableLiveData<String>()
    val scanStatus: LiveData<String> = _scanStatus

    private val rootShellScanner = RootShellScanner()

    /** Set by the Activity to receive a callback (on Main) when threats are found. */
    var onThreatsFound: ((flaggedCount: Int, totalCount: Int) -> Unit)? = null

    private var monitoringJob: Job? = null
    private var continuousMonitoringActive = false

    /**
     * Networks accumulated across multiple monitoring scans, keyed by BSSID (or
     * "anon:<ssid>" for networks with no hardware address).  Cleared when monitoring
     * stops or a fresh one-shot scan begins.  Mirrors WiGLE's ConcurrentLinkedHashMap
     * approach: each new network is appended once and never removed during a session.
     */
    private val sessionNetworks = LinkedHashMap<String, ScannedNetwork>()

    // ── public API ────────────────────────────────────────────────────────

    fun scan(context: Context) {
        if (_isScanning.value == true) return
        viewModelScope.launch { doScan(context) }
    }

    fun startContinuousMonitoring(context: Context) {
        if (continuousMonitoringActive) return
        continuousMonitoringActive = true
        _isMonitoring.value = true
        monitoringJob = viewModelScope.launch {
            while (isActive) {
                doScan(context)
                delay(MONITORING_INTERVAL_MS)
            }
        }
    }

    fun stopContinuousMonitoring() {
        monitoringJob?.cancel()
        monitoringJob = null
        continuousMonitoringActive = false
        _isMonitoring.value = false
        sessionNetworks.clear()
    }

    // ── internal scan logic ───────────────────────────────────────────────

    private suspend fun doScan(context: Context) {
        if (_isScanning.value == true) return
        _isScanning.value = true
        _scanError.value  = null

        // 1. Trigger WiFi scan; await SCAN_RESULTS_AVAILABLE_ACTION broadcast.
        val raw = scanWithReceiver(context)

        // 2. Root frame capture + history load + threat analysis on IO.
        val analysed = withContext(Dispatchers.IO) {
            val rootData = if (RootChecker.isRooted && continuousMonitoringActive) {
                rootShellScanner.scan()
            } else {
                RootScanData()
            }
            val history = storage.loadHistory()
            val result  = threatAnalyzer.analyze(raw, history, rootData)
            if (result.isNotEmpty()) {
                storage.appendRecord(ScanRecord(System.currentTimeMillis(), result))
            }
            result
        }

        // 3. Stream results into the UI one-by-one (WiGLE addWiFi pattern).
        if (continuousMonitoringActive) {
            streamMonitoringResults(analysed)
        } else {
            streamOneShotResults(analysed)
        }

        // 4. Publish final status.
        val flagged = analysed.count { it.isFlagged }
        _scanStatus.value = buildStatusString(analysed.size, flagged)
        if (analysed.isEmpty()) {
            _scanError.value = "No networks found. Ensure location services are enabled and try again."
        }
        _isScanning.value = false
        if (flagged > 0) onThreatsFound?.invoke(flagged, analysed.size)
    }

    /**
     * One-shot scan: clear session state, stream every network in sorted by RSSI
     * descending (strongest signal = most interesting = appears first, like WiGLE).
     * ListAdapter's DiffUtil animates each insertion automatically.
     */
    private suspend fun streamOneShotResults(analysed: List<ScannedNetwork>) {
        sessionNetworks.clear()
        val byRssi = analysed.sortedByDescending { it.rssi }
        val visible = mutableListOf<ScannedNetwork>()
        for (network in byRssi) {
            sessionNetworks[networkKey(network)] = network
            visible.add(network)
            _networks.value  = visible.toList()
            _scanStatus.value = "Scanning\u2026 ${visible.size} / ${analysed.size} found"
            delay(STREAM_DELAY_MS)
        }
        // Final sort: flagged networks float to the top (devsec priority)
        _networks.value = sortNetworks(analysed)
    }

    /**
     * Monitoring mode: update existing entries (RSSI may have changed) and stream
     * only brand-new networks into the list, again sorted strongest-first.
     * Known networks are kept in the live list so the session view grows over time.
     */
    private suspend fun streamMonitoringResults(analysed: List<ScannedNetwork>) {
        val priorKeys = sessionNetworks.keys.toSet()

        // Update all entries (refreshes RSSI on existing items)
        analysed.forEach { n -> sessionNetworks[networkKey(n)] = n }

        val newNetworks = analysed
            .filter { networkKey(it) !in priorKeys }
            .sortedByDescending { it.rssi }

        val flagged = sessionNetworks.values.count { it.isFlagged }

        if (newNetworks.isEmpty()) {
            // Just refresh the list to reflect updated RSSIs
            _networks.value = sortNetworks(sessionNetworks.values)
            return
        }

        // Build the base without new arrivals, then append them one by one
        val base = sortNetworks(sessionNetworks.filter { (k, _) -> k in priorKeys }.values)
            .toMutableList()
        for (n in newNetworks) {
            base.add(n)
            _networks.value  = sortNetworks(base)
            _scanStatus.value = "\u25CF LIVE \u00B7 ${sessionNetworks.size} unique \u00B7 $flagged flagged"
            delay(STREAM_DELAY_MS)
        }
        _networks.value = sortNetworks(sessionNetworks.values)
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private fun networkKey(n: ScannedNetwork): String =
        if (n.bssid.isNotBlank()) n.bssid else "anon:${n.ssid}"

    private fun sortNetworks(networks: Iterable<ScannedNetwork>): List<ScannedNetwork> =
        networks.sortedWith(
            compareByDescending<ScannedNetwork> { it.isFlagged }
                .thenByDescending { it.rssi }
        )

    /**
     * Trigger a hardware scan and suspend until the system broadcasts
     * SCAN_RESULTS_AVAILABLE_ACTION or SCAN_TIMEOUT_MS elapses.
     */
    private suspend fun scanWithReceiver(context: Context): List<ScannedNetwork> {
        val deferred = CompletableDeferred<List<ScannedNetwork>>()

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                try { ctx.unregisterReceiver(this) } catch (_: Exception) {}
                deferred.complete(wifiScanner.getLatestResults())
            }
        }

        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )

        @Suppress("DEPRECATION")
        val started = withContext(Dispatchers.IO) { wifiScanner.startScan() }

        if (!started) {
            try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
            return withContext(Dispatchers.IO) { wifiScanner.getLatestResults() }
        }

        return withTimeoutOrNull(SCAN_TIMEOUT_MS) { deferred.await() }
            ?: run {
                try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
                withContext(Dispatchers.IO) { wifiScanner.getLatestResults() }
            }
    }

    private fun buildStatusString(total: Int, flagged: Int): String {
        if (total == 0) return ""
        val rootTag = if (RootChecker.isRooted) " \u00B7 root+" else ""
        return if (continuousMonitoringActive) {
            val unique = sessionNetworks.size
            "\u25CF LIVE \u00B7 $unique unique \u00B7 $flagged flagged$rootTag"
        } else {
            "Found $total network(s) \u00B7 $flagged flagged$rootTag"
        }
    }

    // ── convenience helpers used by Activity ─────────────────────────────

    fun isWifiEnabled(): Boolean = wifiScanner.isWifiEnabled()

    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

    fun isLocationEnabled(context: Context): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
               lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    companion object {
        private const val SCAN_TIMEOUT_MS        = 10_000L
        /** Reduced from 30 s to 10 s for a live wardriving feel (WiGLE default is ~6–15 s). */
        private const val MONITORING_INTERVAL_MS = 10_000L
        /** Delay between each network appearing in the list — creates a live discovery animation. */
        private const val STREAM_DELAY_MS        = 35L
    }
}
