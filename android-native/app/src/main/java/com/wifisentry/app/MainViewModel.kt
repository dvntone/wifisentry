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
    // Plain field (not LiveData) so it is safe to read from IO dispatcher.
    private var continuousMonitoringActive = false

    // ── public API ────────────────────────────────────────────────────────

    /** Run a single on-demand scan. */
    fun scan(context: Context) {
        if (_isScanning.value == true) return
        viewModelScope.launch { doScan(context) }
    }

    /** Begin periodic automatic scanning every [MONITORING_INTERVAL_MS] ms. */
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

    /** Stop periodic scanning. */
    fun stopContinuousMonitoring() {
        monitoringJob?.cancel()
        monitoringJob = null
        continuousMonitoringActive = false
        _isMonitoring.value = false
    }

    // ── internal scan logic ───────────────────────────────────────────────

    private suspend fun doScan(context: Context) {
        if (_isScanning.value == true) return
        _isScanning.value = true
        _scanError.value  = null

        // 1. Trigger WiFi scan; await SCAN_RESULTS_AVAILABLE_ACTION broadcast.
        val raw = scanWithReceiver(context)

        // 2. Root-enhanced frame capture + history load + threat analysis on IO.
        val analysed = withContext(Dispatchers.IO) {
            val rootData = if (RootChecker.isRooted && continuousMonitoringActive) {
                rootShellScanner.scan()
            } else {
                RootScanData()
            }
            val history  = storage.loadHistory()
            val result   = threatAnalyzer.analyze(raw, history, rootData)
            if (result.isNotEmpty()) {
                storage.appendRecord(ScanRecord(System.currentTimeMillis(), result))
            }
            result
        }

        // 3. Publish results on Main.
        val flagged = analysed.count { it.isFlagged }
        _networks.value   = analysed
        _scanStatus.value = buildStatusString(analysed.size, flagged)
        if (analysed.isEmpty()) {
            _scanError.value =
                "No networks found. Ensure location services are enabled and try again."
        }
        _isScanning.value = false

        if (flagged > 0) onThreatsFound?.invoke(flagged, analysed.size)
    }

    /**
     * Trigger a hardware scan and suspend until the system broadcasts
     * [WifiManager.SCAN_RESULTS_AVAILABLE_ACTION] or [SCAN_TIMEOUT_MS] elapses.
     *
     * Must be called from the Main dispatcher so that the [BroadcastReceiver]
     * is registered and delivered on the correct thread.
     *
     * Falls back to [WifiScanner.getLatestResults] (cached results) when:
     * - Scan is throttled ([WifiManager.startScan] returns false on Android 9+)
     * - The broadcast does not arrive within the timeout
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
            // Throttled or Wi-Fi off — unregister and return cached results immediately.
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
        val rootTag = if (RootChecker.isRooted) " · root+" else ""
        return "Found $total network(s) · $flagged flagged$rootTag"
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
        /** Milliseconds to wait for SCAN_RESULTS_AVAILABLE_ACTION before falling back. */
        private const val SCAN_TIMEOUT_MS        = 10_000L
        /** Milliseconds between automatic scans during continuous monitoring. */
        private const val MONITORING_INTERVAL_MS = 30_000L
    }
}
