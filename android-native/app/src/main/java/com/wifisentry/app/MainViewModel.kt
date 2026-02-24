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
import com.wifisentry.core.OuiLookup
import com.wifisentry.core.RootChecker
import com.wifisentry.core.RootScanData
import com.wifisentry.core.RootShellScanner
import com.wifisentry.core.ScanRecord
import com.wifisentry.core.ScanStats
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatAnalyzer
import com.wifisentry.core.WifiScanner
import com.wifisentry.core.ChangeAnalyzer
import com.wifisentry.core.NetworkChange
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/** User-selectable sort order for the All Networks list. */
// NOTE: SortColumn and NetworkColumn are defined in NetworkColumn.kt

class MainViewModel(
    private val wifiScanner: WifiScanner,
    private val threatAnalyzer: ThreatAnalyzer,
    private val storage: ScanStorage,
) : ViewModel() {

    private val _networks     = MutableLiveData<List<ScannedNetwork>>()
    val networks: LiveData<List<ScannedNetwork>> = _networks

    /** Subset of the current network list that are flagged — drives the threats scroll box. */
    private val _threatNetworks = MutableLiveData<List<ScannedNetwork>>(emptyList())
    val threatNetworks: LiveData<List<ScannedNetwork>> = _threatNetworks

    private val _isScanning   = MutableLiveData(false)
    val isScanning: LiveData<Boolean> = _isScanning

    private val _isMonitoring = MutableLiveData(false)
    val isMonitoring: LiveData<Boolean> = _isMonitoring

    private val _scanError    = MutableLiveData<String?>()
    val scanError: LiveData<String?> = _scanError

    private val _scanStatus   = MutableLiveData<String>()
    val scanStatus: LiveData<String> = _scanStatus

    /** Aggregated statistics shown in the stats panel. */
    private val _scanStats = MutableLiveData(ScanStats())
    val scanStats: LiveData<ScanStats> = _scanStats

    /** When true, distance estimates are shown in feet; when false, metres. */
    private val _distanceInFeet = MutableLiveData(false)
    val distanceInFeet: LiveData<Boolean> = _distanceInFeet

    /** Column by which the network list is currently sorted. */
    private val _sortColumn = MutableLiveData(SortColumn.THREAT)
    val sortColumn: LiveData<SortColumn> = _sortColumn

    /** True = sort in the column's natural "ascending" direction (▲). */
    private val _sortAscending = MutableLiveData(true)
    val sortAscending: LiveData<Boolean> = _sortAscending

    /**
     * Which optional columns are currently visible.  SSID and Signal are always
     * shown and are not in this set.  Both adapters observe this value.
     */
    private val _visibleColumns = MutableLiveData<Set<NetworkColumn>>(ALL_COLUMNS)
    val visibleColumns: LiveData<Set<NetworkColumn>> = _visibleColumns

    /**
     * BSSID → manufacturer name resolved via [OuiLookup] after each scan.
     * Observed by the Activity to pass into both adapters.
     */
    private val _manufacturers = MutableLiveData<Map<String, String>>(emptyMap())
    val manufacturers: LiveData<Map<String, String>> = _manufacturers

    /** Changes detected by [ChangeAnalyzer] after the most recent analysis run. */
    private val _analysisChanges = MutableLiveData<List<NetworkChange>>(emptyList())
    val analysisChanges: LiveData<List<NetworkChange>> = _analysisChanges

    /** True while [analyzeHistory] is running. */
    private val _isAnalyzing = MutableLiveData(false)
    val isAnalyzing: LiveData<Boolean> = _isAnalyzing

    /** Toggle between feet and metres for the distance display. */
    fun toggleDistanceUnit() {
        _distanceInFeet.value = _distanceInFeet.value != true
    }

    /**
     * Set the sort column.  Tapping the same column reverses direction;
     * tapping a new column resets to its [SortColumn.defaultAscending] direction.
     * Mirrors WiGLE's NetworkListSorter approach but driven from column-header taps.
     */
    fun setSort(col: SortColumn) {
        if (_sortColumn.value == col) {
            _sortAscending.value = _sortAscending.value != true
        } else {
            _sortColumn.value  = col
            _sortAscending.value = col.defaultAscending
        }
        // Re-sort existing list immediately, no new scan needed
        val current = sessionNetworks.values.toList()
        if (current.isNotEmpty()) _networks.value = sortNetworks(current)
    }

    /**
     * Toggle the visibility of an optional column.
     * Both adapters observe [visibleColumns] and update their item views.
     */
    fun toggleColumn(col: NetworkColumn) {
        val current = _visibleColumns.value ?: ALL_COLUMNS
        _visibleColumns.value = if (col in current) current - col else current + col
    }

    /**
     * Run [ChangeAnalyzer] on the full stored scan history.
     * Executes on [Dispatchers.IO] and posts results back to the main thread.
     * Safe to call from any thread; no-ops if already running.
     */
    fun analyzeHistory(context: android.content.Context) {
        if (_isAnalyzing.value == true) return
        _isAnalyzing.value = true
        viewModelScope.launch(Dispatchers.IO) {
            val history = ScanStorage(context).loadHistory()
            val result  = ChangeAnalyzer.analyze(history)
            _analysisChanges.postValue(result.changes)
            _isAnalyzing.postValue(false)
        }
    }

    private val rootShellScanner = RootShellScanner()

    /** Last GPS fix obtained before a scan, used to tag each network. */
    private var lastKnownLocation: android.location.Location? = null

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

    /** Trigger a background OUI database refresh from GitHub. */
    fun refreshOuiDatabase(context: Context) {
        viewModelScope.launch { OuiLookup.updateFromGitHub(context) }
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
        _threatNetworks.value = emptyList()
        _scanStats.value = ScanStats()
    }

    // ── internal scan logic ───────────────────────────────────────────────

    private suspend fun doScan(context: Context) {
        if (_isScanning.value == true) return
        _isScanning.value = true
        _scanError.value  = null
        try {

        // Refresh GPS fix before the scan so networks are tagged with current position.
        updateLastKnownLocation(context)

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

            // Tag every network with the last known GPS fix.
            val loc = lastKnownLocation
            val tagged = if (loc != null) {
                result.map { n ->
                    n.copy(
                        latitude    = loc.latitude,
                        longitude   = loc.longitude,
                        altitude    = loc.altitude,
                        gpsAccuracy = loc.accuracy,
                    )
                }
            } else result

            if (tagged.isNotEmpty()) {
                storage.appendRecord(ScanRecord(System.currentTimeMillis(), tagged))
            }
            tagged
        }

        // 3. Resolve OUI manufacturer names on IO, then publish to adapters.
        val mfgrMap = withContext(Dispatchers.IO) {
            analysed.associate { n ->
                n.bssid to OuiLookup.lookup(context, n.bssid)
            }.filterValues { value -> value.isNotEmpty() }
        }
        _manufacturers.value = mfgrMap

        // 4. Stream results into the UI one-by-one (WiGLE addWiFi pattern).
        if (continuousMonitoringActive) {
            streamMonitoringResults(analysed)
        } else {
            streamOneShotResults(analysed)
        }

        // 5. Update threat list, stats, and final status.
        val flagged = analysed.count { it.isFlagged }
        _threatNetworks.value = if (continuousMonitoringActive) {
            sortNetworks(sessionNetworks.values.filter { it.isFlagged })
        } else {
            sortNetworks(analysed.filter { it.isFlagged })
        }

        val stats = withContext(Dispatchers.IO) {
            val history      = storage.loadHistory()
            val allNetworks  = history.flatMap { it.networks }
            ScanStats(
                totalThisScan   = analysed.size,
                threatsThisScan = flagged,
                sessionUnique   = sessionNetworks.size,
                sessionThreats  = sessionNetworks.values.count { it.isFlagged },
                totalAllTime    = allNetworks.size,
                threatsAllTime  = allNetworks.count { it.isFlagged },
            )
        }
        _scanStats.value = stats

        _scanStatus.value = buildStatusString(analysed.size, flagged)
        if (analysed.isEmpty()) {
            _scanError.value = "No networks found. Ensure location services are enabled and try again."
        }
        if (flagged > 0) onThreatsFound?.invoke(flagged, analysed.size)

        } catch (e: Exception) {
            _scanError.postValue("Scan failed: ${e.javaClass.simpleName}${e.message?.let { " — $it" } ?: ""}")
        } finally {
            _isScanning.postValue(false)
        }
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
        // Final sort: apply current sort order
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

    private fun sortNetworks(networks: Iterable<ScannedNetwork>): List<ScannedNetwork> {
        val col = _sortColumn.value ?: SortColumn.THREAT
        val asc = _sortAscending.value ?: true
        val comparator: Comparator<ScannedNetwork> = when (col) {
            SortColumn.THREAT -> compareByDescending<ScannedNetwork> { it.isFlagged }
                .thenBy { it.highestSeverity?.ordinal ?: Int.MAX_VALUE }
                .thenByDescending { it.rssi }
            SortColumn.SIGNAL  -> compareByDescending { it.rssi }
            SortColumn.SSID    -> compareBy<ScannedNetwork> { it.ssid.lowercase() }
                .thenByDescending { it.rssi }
            SortColumn.CHANNEL -> compareBy { it.frequency }
        }
        val sorted = networks.sortedWith(comparator)
        return if (asc) sorted else sorted.reversed()
    }

    /**
     * Fetch the most-recently-updated location from GPS or network providers.
     * Requires ACCESS_FINE_LOCATION; silently skips if permission is absent.
     */
    private fun updateLastKnownLocation(context: Context) {
        if (!hasLocationPermission(context)) return
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        lastKnownLocation = providers
            .mapNotNull { provider ->
                try {
                    @Suppress("MissingPermission")
                    lm.getLastKnownLocation(provider)
                } catch (_: Exception) { null }
            }
            .maxByOrNull { it.time }
    }

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

        val registered = try {
            ContextCompat.registerReceiver(
                context,
                receiver,
                IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            true
        } catch (_: Exception) { false }

        if (!registered) {
            return withContext(Dispatchers.IO) { wifiScanner.getLatestResults() }
        }

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
        /**
         * 10 s is intentional for the live wardriving feel (WiGLE uses ~6–15 s).
         * Android 9+ throttles to 4 scans / 2 min from the foreground; cached
         * results are returned when throttled so battery impact is bounded.
         * Consider exposing this as a user preference in a future settings screen.
         */
        private const val MONITORING_INTERVAL_MS = 10_000L
        /** Delay between each network appearing in the list — creates a live discovery animation. */
        private const val STREAM_DELAY_MS        = 35L
    }
}
