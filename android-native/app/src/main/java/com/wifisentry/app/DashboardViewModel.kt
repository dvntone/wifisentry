package com.wifisentry.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.wifisentry.core.RootScanData
import com.wifisentry.core.ScanRecord
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ShizukuWifiScanner
import com.wifisentry.core.ThreatEngine
import com.wifisentry.core.WifiScanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * UI state for the Compose dashboard.
 */
data class DashboardUiState(
    val isScanning: Boolean = false,
    val networks: List<ScannedNetwork> = emptyList(),
    val scanHistory: List<ScanRecord> = emptyList(),
    val errorMessage: String? = null,
    /** True when Shizuku is available and grants unthrottled scan access. */
    val shizukuActive: Boolean = false,
    /** Linux UID under which privileged ops are running (0 = root, 2000 = ADB shell). */
    val privilegeUid: Int = -1,
)

/**
 * ViewModel for the Compose-based network dashboard.
 *
 * Follows MVVM architecture: all Wi-Fi scanning and threat analysis runs on
 * [Dispatchers.IO]; UI state is exposed via [StateFlow] so Compose reacts
 * reactively without blocking the main thread.
 *
 * Scanner priority (mirrors the full scanner chain):
 * 1. Shizuku — unthrottled ADB shell scans
 * 2. Standard WifiManager — throttled fallback
 */
class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val wifiScanner = WifiScanner(application)
    private val shizukuScanner = ShizukuWifiScanner(application)
    private val threatEngine = ThreatEngine()

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    private var monitorJob: Job? = null

    /** Start continuous monitoring. Each scan interval runs [scanOnce]. */
    fun startMonitoring(intervalMs: Long = DEFAULT_SCAN_INTERVAL_MS) {
        if (monitorJob?.isActive == true) return
        monitorJob = viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = _uiState.value.copy(isScanning = true)
            while (isActive) {
                scanOnce()
                delay(intervalMs)
            }
        }
    }

    /** Stop continuous monitoring. */
    fun stopMonitoring() {
        monitorJob?.cancel()
        _uiState.value = _uiState.value.copy(isScanning = false)
    }

    /** Perform a single scan cycle and update [uiState]. */
    fun triggerSingleScan() {
        viewModelScope.launch(Dispatchers.IO) { scanOnce() }
    }

    private suspend fun scanOnce() {
        try {
            val shizukuAvailable = shizukuScanner.isAvailable()
            val uid = if (shizukuAvailable) shizukuScanner.getShizukuUid() else -1

            // Collect root/Shizuku frame data if available
            val rootData: RootScanData = if (shizukuAvailable) {
                shizukuScanner.scan()
            } else {
                RootScanData()
            }

            // Trigger a WifiManager scan (standard tier)
            wifiScanner.startScan()

            // Wait for scan results: WifiManager.registerScanResultsCallback (API 30+)
            // would be more responsive, but requires additional lifecycle management.
            // This simple coroutine delay is acceptable since scanning runs on
            // Dispatchers.IO and does not block the main thread.
            delay(SCAN_SETTLE_DELAY_MS)

            val raw = wifiScanner.getLatestResults()
            val history = _uiState.value.scanHistory

            val annotated = if (rootData.rootActive) {
                threatEngine.analyze(raw, history, rootData)
            } else {
                threatEngine.analyze(raw, history)
            }

            val newRecord = ScanRecord(
                timestampMs = System.currentTimeMillis(),
                networks    = annotated,
            )
            val newHistory = (history + newRecord).takeLast(MAX_HISTORY_RECORDS)

            withContext(Dispatchers.Main) {
                _uiState.value = _uiState.value.copy(
                    networks       = annotated,
                    scanHistory    = newHistory,
                    shizukuActive  = shizukuAvailable,
                    privilegeUid   = uid,
                    errorMessage   = null,
                )
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                _uiState.value = _uiState.value.copy(
                    errorMessage = "Scan error: ${e.localizedMessage}",
                )
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopMonitoring()
        threatEngine.reset()
    }

    companion object {
        private const val DEFAULT_SCAN_INTERVAL_MS = 30_000L
        private const val SCAN_SETTLE_DELAY_MS     = 2_000L
        private const val MAX_HISTORY_RECORDS      = 50
    }
}
