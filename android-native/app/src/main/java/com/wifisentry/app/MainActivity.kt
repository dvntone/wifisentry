package com.wifisentry.app

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.TypedValue
import android.view.View
import android.widget.PopupMenu
import android.widget.ScrollView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.wifisentry.app.databinding.ActivityMainBinding
import com.wifisentry.core.GeminiAnalyzer
import com.wifisentry.core.PinnedNetwork
import com.wifisentry.core.PinnedStorage
import com.wifisentry.core.ScanStats
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatAnalyzer
import com.wifisentry.core.WifiDisplayUtils
import com.wifisentry.core.WifiScanner
import com.wifisentry.core.ChangeType
import com.wifisentry.core.NetworkChange
import com.wifisentry.core.ThreatSeverity

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    /** Adapter for the "All Networks" scroll box. */
    private lateinit var adapter: ScanResultAdapter
    /** Adapter for the "Threats Detected" scroll box. */
    private lateinit var threatAdapter: ScanResultAdapter

    private val viewModel: MainViewModel by viewModels {
        object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                @Suppress("UNCHECKED_CAST")
                return MainViewModel(
                    WifiScanner(applicationContext),
                    ThreatAnalyzer(),
                    ScanStorage(applicationContext),
                ) as T
            }
        }
    }

    private val requestLocationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) performScan() else showSnackbar(R.string.permission_denied_message)
            updateStatusBanner()
        }

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    private val requestNearbyWifiPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Show any crash report saved from the previous session so the user
        // can copy and report diagnostics without needing adb/logcat.
        showPreviousCrashReportIfAny()

        try {
            NotificationHelper.createChannel(this)
            requestNearbyWifiPermissionIfNeeded()
            requestNotificationPermissionIfNeeded()
            requestLocationPermissionIfNeeded()

            // All Networks list
            adapter = ScanResultAdapter()
            adapter.onNetworkClick = { network -> showNetworkActionSheet(network) }
            binding.recyclerNetworks.layoutManager = LinearLayoutManager(this)
            binding.recyclerNetworks.adapter = adapter

            // Threats Detected list — flagged networks only
            threatAdapter = ScanResultAdapter()
            threatAdapter.onNetworkClick = { network -> showNetworkActionSheet(network) }
            binding.recyclerThreats.layoutManager = LinearLayoutManager(this)
            binding.recyclerThreats.adapter = threatAdapter

            binding.buttonScan.setOnClickListener { onScanClicked() }
            binding.buttonMonitor.setOnClickListener { onMonitorClicked() }
            binding.buttonHistory.setOnClickListener {
                startActivity(Intent(this, HistoryActivity::class.java))
            }
            binding.buttonDistanceUnit.setOnClickListener { viewModel.toggleDistanceUnit() }

            // Active analysis button
            binding.buttonAnalyze.setOnClickListener {
                viewModel.analyzeHistory(applicationContext)
            }

            // Column header sort taps
            binding.layoutColThreat.setOnClickListener  { viewModel.setSort(SortColumn.THREAT) }
            binding.layoutColSsid.setOnClickListener    { viewModel.setSort(SortColumn.SSID)   }
            binding.layoutColSignal.setOnClickListener  { viewModel.setSort(SortColumn.SIGNAL) }
            binding.layoutColChannel.setOnClickListener { viewModel.setSort(SortColumn.CHANNEL) }

            // Column visibility ⋮ menu (both buttons open the same menu)
            binding.buttonAllColumnsMenu.setOnClickListener    { showColumnMenu(it) }
            binding.buttonThreatsColumnsMenu.setOnClickListener { showColumnMenu(it) }

            binding.textWifiStatus.setOnClickListener {
                startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
            }
            binding.textLocationStatus.setOnClickListener {
                startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }

            viewModel.onThreatsFound = { flagged, total ->
                NotificationHelper.notifyThreats(this, flagged, total)
            }

            // Kick off a background OUI database refresh on launch
            viewModel.refreshOuiDatabase(this)

            observeViewModel()
            updateStatusBanner()
        } catch (e: Exception) {
            // Save the report so it persists even if the process is killed, then
            // show it immediately on this same launch so the user can copy it.
            WifiSentryApp.saveCrashReport(applicationContext, e)
            showStartupCrashDialog(e)
        }
    }

    override fun onResume() {
        super.onResume()
        updateStatusBanner()
    }

    private fun onScanClicked() {
        if (!viewModel.hasLocationPermission(this)) {
            requestLocationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            return
        }
        performScan()
    }

    private fun onMonitorClicked() {
        if (!viewModel.hasLocationPermission(this)) {
            requestLocationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            return
        }
        if (viewModel.isMonitoring.value == true) {
            viewModel.stopContinuousMonitoring()
        } else {
            if (!viewModel.isWifiEnabled()) {
                showSnackbar(R.string.wifi_disabled_message)
                return
            }
            if (!viewModel.isLocationEnabled(this)) {
                Snackbar.make(binding.root, R.string.location_disabled_message, Snackbar.LENGTH_LONG)
                    .setAction(R.string.action_settings) {
                        startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                    }.show()
                return
            }
            viewModel.startContinuousMonitoring(this)
        }
    }

    private fun performScan() {
        updateStatusBanner()
        if (!viewModel.isWifiEnabled()) {
            Snackbar.make(binding.root, R.string.wifi_disabled_message, Snackbar.LENGTH_LONG)
                .setAction(R.string.action_settings) {
                    startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
                }.show()
            return
        }
        if (!viewModel.isLocationEnabled(this)) {
            Snackbar.make(binding.root, R.string.location_disabled_message, Snackbar.LENGTH_LONG)
                .setAction(R.string.action_settings) {
                    startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                }.show()
            return
        }
        viewModel.scan(this)
    }

    private fun observeViewModel() {
        viewModel.networks.observe(this) { networks ->
            adapter.submitList(networks)
            binding.textAllNetworksHeader.text =
                getString(R.string.label_all_networks_header, networks.size)
        }

        viewModel.threatNetworks.observe(this) { threats ->
            threatAdapter.submitList(threats)
            binding.textThreatsHeader.text =
                getString(R.string.label_threats_header, threats.size)
        }

        viewModel.scanStats.observe(this) { stats ->
            updateStatsCard(stats)
        }

        viewModel.distanceInFeet.observe(this) { useFeet ->
            adapter.distanceInFeet      = useFeet
            threatAdapter.distanceInFeet = useFeet
            binding.buttonDistanceUnit.text =
                getString(if (useFeet) R.string.button_unit_feet else R.string.button_unit_meters)
        }

        viewModel.sortColumn.observe(this) { col ->
            updateColumnHeaders(col, viewModel.sortAscending.value ?: true)
        }
        viewModel.sortAscending.observe(this) { asc ->
            updateColumnHeaders(viewModel.sortColumn.value ?: SortColumn.THREAT, asc)
        }
        viewModel.visibleColumns.observe(this) { cols ->
            adapter.visibleColumns      = cols
            threatAdapter.visibleColumns = cols
            binding.layoutColChannel.visibility = if (NetworkColumn.CHANNEL in cols) View.VISIBLE else View.GONE
        }

        viewModel.manufacturers.observe(this) { mfgrMap ->
            adapter.manufacturers      = mfgrMap
            threatAdapter.manufacturers = mfgrMap
        }

        viewModel.isScanning.observe(this) { scanning ->
            binding.buttonScan.isEnabled =
                !scanning && viewModel.isMonitoring.value != true
            binding.progressScan.visibility = if (scanning) View.VISIBLE else View.GONE
        }

        viewModel.isMonitoring.observe(this) { monitoring ->
            binding.buttonMonitor.text = getString(
                if (monitoring) R.string.button_stop_monitoring
                else            R.string.button_start_monitoring
            )
            binding.buttonScan.isEnabled =
                !monitoring && viewModel.isScanning.value != true
        }

        viewModel.scanError.observe(this) { error ->
            if (!error.isNullOrBlank()) showSnackbar(error)
        }

        viewModel.scanStatus.observe(this) { status ->
            binding.textScanStatus.text = status
        }

        viewModel.isAnalyzing.observe(this) { running ->
            binding.buttonAnalyze.isEnabled = !running
            binding.buttonAnalyze.text = if (running)
                getString(R.string.button_analyzing)
            else
                getString(R.string.button_analyze)
        }

        viewModel.analysisChanges.observe(this) { changes ->
            if (changes.isEmpty()) {
                binding.textChangesSummary.text = getString(R.string.analysis_no_changes)
            } else {
                val high   = changes.count { it.severity == ThreatSeverity.HIGH }
                val medium = changes.count { it.severity == ThreatSeverity.MEDIUM }
                binding.textChangesSummary.text = getString(R.string.analysis_summary, changes.size, high, medium)
                if (high > 0) showAnalysisDialog(changes)
            }
        }
    }

    private fun updateStatsCard(stats: ScanStats) {
        binding.textStatThisScan.text =
            getString(R.string.stat_this_scan, stats.totalThisScan, stats.threatsThisScan)
        binding.textStatSession.text =
            getString(R.string.stat_session, stats.sessionUnique, stats.sessionThreats)
        binding.textStatAllTime.text =
            getString(R.string.stat_all_time, stats.totalAllTime, stats.threatsAllTime)
    }

    private fun updateStatusBanner() {
        val wifiOk = viewModel.isWifiEnabled()
        val permOk = viewModel.hasLocationPermission(this)
        val locOk  = viewModel.isLocationEnabled(this)

        binding.textWifiStatus.apply {
            text = getString(if (wifiOk) R.string.status_wifi_on else R.string.status_wifi_off)
            setTextColor(ContextCompat.getColor(this@MainActivity,
                if (wifiOk) R.color.status_ok else R.color.status_error))
        }
        binding.textPermissionStatus.apply {
            text = getString(if (permOk) R.string.status_permission_granted
                             else        R.string.status_permission_missing)
            setTextColor(ContextCompat.getColor(this@MainActivity,
                if (permOk) R.color.status_ok else R.color.status_error))
        }
        binding.textLocationStatus.apply {
            text = getString(if (locOk) R.string.status_location_on else R.string.status_location_off)
            setTextColor(ContextCompat.getColor(this@MainActivity,
                if (locOk) R.color.status_ok else R.color.status_error))
        }

        val ready = wifiOk && permOk && locOk && viewModel.isScanning.value != true
        binding.buttonScan.isEnabled    = ready && viewModel.isMonitoring.value != true
        binding.buttonMonitor.isEnabled = permOk
    }

    /**
     * Show permission-rationale dialogs sequentially so they never stack on top of
     * each other.  On first launch up to three rationale dialogs may be required
     * (nearby-Wi-Fi, notifications, location); each one chains to the next via its
     * dismiss listener so only one dialog is visible at a time.
     *
     * Previously all three were shown synchronously in onCreate() which could
     * present multiple overlapping windows and, on some devices / Android versions,
     * trigger a WindowManager exception before the Activity window was ready.
     */
    private fun requestNearbyWifiPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.NEARBY_WIFI_DEVICES)
                != PackageManager.PERMISSION_GRANTED
        ) {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.perm_nearby_wifi_title)
                .setMessage(R.string.perm_nearby_wifi_message)
                .setPositiveButton(R.string.perm_nearby_wifi_allow) { _, _ ->
                    requestNearbyWifiPermission.launch(Manifest.permission.NEARBY_WIFI_DEVICES)
                }
                .setNegativeButton(R.string.perm_nearby_wifi_skip, null)
                // Chain: once this dialog closes, show the next one.
                .setOnDismissListener { requestNotificationPermissionIfNeeded() }
                .show()
        } else {
            // Permission already granted or not required — move straight to the next step.
            requestNotificationPermissionIfNeeded()
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.perm_notif_title)
                .setMessage(R.string.perm_notif_message)
                .setPositiveButton(R.string.perm_notif_allow) { _, _ ->
                    requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                .setNegativeButton(R.string.perm_notif_skip, null)
                // Chain: once this dialog closes, show the next one.
                .setOnDismissListener { requestLocationPermissionIfNeeded() }
                .show()
        } else {
            requestLocationPermissionIfNeeded()
        }
    }

    /** Show a location-permission rationale dialog on first launch. */
    private fun requestLocationPermissionIfNeeded() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
        ) {
            MaterialAlertDialogBuilder(this)
                .setTitle(R.string.perm_location_title)
                .setMessage(R.string.perm_location_message)
                .setPositiveButton(R.string.perm_location_allow) { _, _ ->
                    requestLocationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                }
                .setNegativeButton(R.string.perm_location_skip, null)
                .show()
        }
    }

    /**
     * If a crash occurred in a previous session, show the stack trace in a
     * scrollable Material dialog so the user can copy it without needing adb.
     * The report file is deleted after being shown so it only appears once.
     */
    private fun showPreviousCrashReportIfAny() {
        val report = WifiSentryApp.consumeCrashReport(applicationContext) ?: return
        val ctx = this
        val scroll = android.widget.ScrollView(ctx)
        val tv = android.widget.TextView(ctx).apply {
            text = report
            textSize = 11f
            setTextIsSelectable(true)
            val pad = (12 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(tv)
        MaterialAlertDialogBuilder(ctx)
            .setTitle(getString(R.string.crash_report_title))
            .setMessage(getString(R.string.crash_report_message))
            .setView(scroll)
            .setPositiveButton(R.string.dialog_close, null)
            .show()
    }

    /**
     * Show the stack trace from [throwable] immediately on this launch so
     * the user can copy and report it without needing a second app open.
     * Called from the try-catch in [onCreate] when startup itself crashes.
     */
    private fun showStartupCrashDialog(throwable: Throwable) {
        val sw = java.io.StringWriter()
        throwable.printStackTrace(java.io.PrintWriter(sw))
        val scroll = android.widget.ScrollView(this)
        val tv = android.widget.TextView(this).apply {
            text = sw.toString()
            textSize = 11f
            setTextIsSelectable(true)
            val pad = (12 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(tv)
        try {
            MaterialAlertDialogBuilder(this)
                .setTitle(getString(R.string.crash_report_title))
                .setMessage(getString(R.string.crash_report_message))
                .setView(scroll)
                .setPositiveButton(R.string.dialog_close, null)
                .show()
        } catch (_: Exception) { /* file-based report is the fallback */ }
    }

    private fun showSnackbar(resId: Int) {
        Snackbar.make(binding.root, resId, Snackbar.LENGTH_LONG).show()
    }

    private fun showSnackbar(message: String) {
        Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG).show()
    }

    /**
     * Updates the column-header indicator bars and label text to reflect the
     * current sort column and direction.
     *
     * Active column: indicator bar VISIBLE + label bold + ▲/▼ arrow appended.
     * Inactive columns: indicator bar INVISIBLE + label normal weight, no arrow.
     */
    private fun updateColumnHeaders(col: SortColumn, asc: Boolean) {
        data class ColHeader(
            val container: android.view.View,
            val label: android.widget.TextView,
            val indicator: android.view.View,
            val sortCol: SortColumn,
            val labelRes: Int,
        )
        val headers = listOf(
            ColHeader(binding.layoutColThreat,  binding.textColThreat,  binding.indColThreat,  SortColumn.THREAT,  R.string.col_threat),
            ColHeader(binding.layoutColSsid,    binding.textColSsid,    binding.indColSsid,    SortColumn.SSID,    R.string.col_ssid),
            ColHeader(binding.layoutColSignal,  binding.textColSignal,  binding.indColSignal,  SortColumn.SIGNAL,  R.string.col_signal),
            ColHeader(binding.layoutColChannel, binding.textColChannel, binding.indColChannel, SortColumn.CHANNEL, R.string.col_channel),
        )
        headers.forEach { h ->
            val isActive = h.sortCol == col
            val base     = getString(h.labelRes)
            h.label.text = if (isActive) "$base ${if (asc) "▲" else "▼"}" else base
            h.label.setTypeface(null, if (isActive) Typeface.BOLD else Typeface.NORMAL)
            h.indicator.visibility = if (isActive) View.VISIBLE else View.INVISIBLE
        }
    }

    /**
     * Shows a PopupMenu anchored to [anchor] listing all optional columns with
     * check-marks.  Both the All Networks and Threats ⋮ buttons call this method.
     */
    private fun showColumnMenu(anchor: android.view.View) {
        val visible = viewModel.visibleColumns.value ?: ALL_COLUMNS
        val popup   = PopupMenu(this, anchor)
        popup.menuInflater.inflate(R.menu.menu_column_options, popup.menu)
        popup.menu.findItem(R.id.col_bssid)?.isChecked          = NetworkColumn.BSSID in visible
        popup.menu.findItem(R.id.col_channel)?.isChecked        = NetworkColumn.CHANNEL in visible
        popup.menu.findItem(R.id.col_security_text)?.isChecked  = NetworkColumn.SECURITY_TEXT in visible
        popup.menu.findItem(R.id.col_distance)?.isChecked       = NetworkColumn.DISTANCE in visible
        popup.menu.findItem(R.id.col_threats)?.isChecked        = NetworkColumn.THREATS in visible
        popup.setOnMenuItemClickListener { item ->
            val col = when (item.itemId) {
                R.id.col_bssid         -> NetworkColumn.BSSID
                R.id.col_channel       -> NetworkColumn.CHANNEL
                R.id.col_security_text -> NetworkColumn.SECURITY_TEXT
                R.id.col_distance      -> NetworkColumn.DISTANCE
                R.id.col_threats       -> NetworkColumn.THREATS
                else                   -> null
            }
            col?.let { viewModel.toggleColumn(it) }
            true
        }
        popup.show()
    }

    /**
     * Display active analysis results in a scrollable Material dialog.
     * Each [NetworkChange] row is colour-coded by severity and shows:
     *   [severity icon] SSID · ChangeType  (score/100)
     *   description (first 140 chars)
     *
     * The description field is Gemini-ready: if a Gemini API key is added,
     * this same text can be sent directly to the Gemini API for AI enrichment.
     */
    private fun showAnalysisDialog(changes: List<NetworkChange>) {
        val ctx = this
        val scrollView = ScrollView(ctx)
        val container = android.widget.LinearLayout(ctx).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            val pad = (12 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scrollView.addView(container)

        changes.take(30).forEach { change ->
            val icon = when (change.severity) {
                ThreatSeverity.HIGH   -> "🔴"
                ThreatSeverity.MEDIUM -> "🟠"
                ThreatSeverity.LOW    -> "🟡"
            }
            val colorRes = when (change.severity) {
                ThreatSeverity.HIGH   -> R.color.status_error
                ThreatSeverity.MEDIUM -> R.color.status_warning
                ThreatSeverity.LOW    -> R.color.status_ok
            }
            val title = android.widget.TextView(ctx).apply {
                text = "$icon ${change.ssid.ifBlank { change.bssid }} · " +
                        "${change.type.name.lowercase().replace('_', ' ')} (${change.score}/100)"
                textSize  = 12f
                setTypeface(null, Typeface.BOLD)
                setTextColor(getColor(colorRes))
                val pad = (4 * resources.displayMetrics.density).toInt()
                setPadding(0, pad * 2, 0, 0)
            }
            val body = android.widget.TextView(ctx).apply {
                text = change.description.take(140)
                textSize = 11f
                val pad = (4 * resources.displayMetrics.density).toInt()
                setPadding(0, 0, 0, pad)
            }
            container.addView(title)
            container.addView(body)
        }

        com.google.android.material.dialog.MaterialAlertDialogBuilder(ctx)
            .setTitle(getString(R.string.analysis_dialog_title, changes.size))
            .setView(scrollView)
            .setPositiveButton(R.string.dialog_close, null)
            .show()
    }

    /**
     * Action-sheet popup shown when the user taps any network in the list.
     *
     * Options:
     *  • Copy SSID
     *  • Copy MAC (BSSID)
     *  • Copy All Details
     *  • Pin for Tracking  / Unpin
     *  • View Details        (existing detail dialog)
     *  • Ask Gemini AI       (opens PinDetailActivity with Gemini prompt)
     */
    private fun showNetworkActionSheet(network: ScannedNetwork) {
        val ssid    = network.ssid.ifBlank { getString(R.string.hidden_ssid) }
        val storage = PinnedStorage(applicationContext)
        val isPinned = storage.isPinned(network.bssid)

        val items = mutableListOf(
            getString(R.string.action_copy_ssid),
            getString(R.string.action_copy_bssid),
            getString(R.string.action_copy_all),
            if (isPinned) getString(R.string.action_unpin) else getString(R.string.action_pin),
            getString(R.string.action_view_details),
            getString(R.string.action_ask_gemini),
        )

        MaterialAlertDialogBuilder(this)
            .setTitle(ssid)
            .setItems(items.toTypedArray()) { _, which ->
                when (which) {
                    0 -> copyToClipboard(network.ssid, R.string.copied_ssid)
                    1 -> copyToClipboard(network.bssid, R.string.copied_bssid)
                    2 -> copyToClipboard(buildAllDetailsText(network), R.string.copied_all)
                    3 -> togglePin(network, storage)
                    4 -> showNetworkDetailDialog(network)
                    5 -> openPinDetail(network)
                }
            }
            .setNegativeButton(R.string.dialog_close, null)
            .show()
    }

    private fun copyToClipboard(text: String, toastResId: Int) {
        val cm = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("wifisentry", text))
        Snackbar.make(binding.root, toastResId, Snackbar.LENGTH_SHORT).show()
    }

    private fun buildAllDetailsText(network: ScannedNetwork): String {
        val ssid     = network.ssid.ifBlank { getString(R.string.hidden_ssid) }
        val security = WifiDisplayUtils.capabilitiesToSecurityLabel(network.capabilities)
        val band     = WifiDisplayUtils.frequencyToBand(network.frequency)
        val channel  = WifiDisplayUtils.frequencyToChannel(network.frequency)
        val mfgr     = viewModel.manufacturers.value?.get(network.bssid)
        return buildString {
            appendLine("SSID: $ssid")
            appendLine("BSSID: ${network.bssid}")
            if (!mfgr.isNullOrBlank()) appendLine("Manufacturer: $mfgr")
            appendLine("Signal: ${network.rssi} dBm")
            appendLine("Security: $security")
            if (band.isNotBlank()) appendLine("Band: $band  Channel: $channel")
            if (network.isFlagged) {
                appendLine("Threats: ${network.threats.joinToString { it.displayName(this@MainActivity) }}")
            }
        }.trimEnd()
    }

    private fun togglePin(network: ScannedNetwork, storage: PinnedStorage) {
        if (storage.isPinned(network.bssid)) {
            storage.unpin(network.bssid)
            val label = network.ssid.ifBlank { network.bssid }
            Snackbar.make(binding.root, getString(R.string.pin_removed, label), Snackbar.LENGTH_SHORT).show()
        } else {
            val pin = PinnedNetwork(bssid = network.bssid, ssid = network.ssid)
            storage.pin(pin)
            val label = network.ssid.ifBlank { network.bssid }
            Snackbar.make(binding.root, getString(R.string.pin_added, label), Snackbar.LENGTH_SHORT)
                .setAction(R.string.action_view_details) { openPinDetail(network) }
                .show()
        }
    }

    private fun openPinDetail(network: ScannedNetwork) {
        // Ensure the network is pinned before opening the detail page
        val storage = PinnedStorage(applicationContext)
        if (!storage.isPinned(network.bssid)) {
            storage.pin(PinnedNetwork(bssid = network.bssid, ssid = network.ssid))
        }
        val intent = Intent(this, PinDetailActivity::class.java).apply {
            putExtra(PinDetailActivity.EXTRA_BSSID, network.bssid)
            putExtra(PinDetailActivity.EXTRA_SSID,  network.ssid)
        }
        startActivity(intent)
    }

    private fun showNetworkDetailDialog(network: ScannedNetwork) {
        val ssid      = network.ssid.ifBlank { getString(R.string.hidden_ssid) }
        val security  = WifiDisplayUtils.capabilitiesToSecurityLabel(network.capabilities)
        val band      = WifiDisplayUtils.frequencyToBand(network.frequency)
        val channel   = WifiDisplayUtils.frequencyToChannel(network.frequency)
        val rssiLabel = WifiDisplayUtils.rssiToLabel(network.rssi)
        val useFeet   = viewModel.distanceInFeet.value == true
        val distM     = WifiDisplayUtils.rssiToDistanceMeters(network.rssi, network.frequency)
        val distLabel = WifiDisplayUtils.formatDistance(distM, useFeet)

        val sb = StringBuilder()
        sb.appendLine(getString(R.string.detail_label_ssid, ssid))
        sb.appendLine(getString(R.string.detail_label_bssid, network.bssid))
        val mfgr = viewModel.manufacturers.value?.get(network.bssid)
        if (!mfgr.isNullOrBlank()) sb.appendLine(getString(R.string.detail_label_manufacturer, mfgr))
        sb.appendLine(getString(R.string.detail_label_signal, network.rssi, rssiLabel))
        sb.appendLine(getString(R.string.detail_label_distance, distLabel))
        if (band.isNotBlank()) sb.appendLine(getString(R.string.detail_label_band, band, channel))
        sb.appendLine(getString(R.string.detail_label_security, security))
        if (network.hasGpsFix) {
            sb.appendLine(getString(R.string.detail_label_gps,
                network.latitude, network.longitude))
        }
        sb.append(getString(R.string.detail_threats_header))
        network.threats.forEach { threat ->
            sb.appendLine("• ${threat.displayName(this)}")
            sb.appendLine("  ${threat.detailDescription(this)}")
        }

        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.dialog_network_detail_title)
            .setMessage(sb.toString().trimEnd())
            .setPositiveButton(R.string.dialog_close, null)
            .show()
    }
}
