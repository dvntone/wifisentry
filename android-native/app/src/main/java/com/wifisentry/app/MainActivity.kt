package com.wifisentry.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.wifisentry.app.databinding.ActivityMainBinding
import com.wifisentry.core.ScanStats
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatAnalyzer
import com.wifisentry.core.WifiDisplayUtils
import com.wifisentry.core.WifiScanner

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        NotificationHelper.createChannel(this)
        requestNotificationPermissionIfNeeded()

        // All Networks list
        adapter = ScanResultAdapter()
        adapter.onNetworkClick = { network -> showNetworkDetailDialog(network) }
        binding.recyclerNetworks.layoutManager = LinearLayoutManager(this)
        binding.recyclerNetworks.adapter = adapter

        // Threats Detected list — flagged networks only
        threatAdapter = ScanResultAdapter()
        threatAdapter.onNetworkClick = { network -> showNetworkDetailDialog(network) }
        binding.recyclerThreats.layoutManager = LinearLayoutManager(this)
        binding.recyclerThreats.adapter = threatAdapter

        binding.buttonScan.setOnClickListener { onScanClicked() }
        binding.buttonMonitor.setOnClickListener { onMonitorClicked() }
        binding.buttonHistory.setOnClickListener {
            startActivity(Intent(this, HistoryActivity::class.java))
        }
        binding.buttonDistanceUnit.setOnClickListener { viewModel.toggleDistanceUnit() }
        binding.textWifiStatus.setOnClickListener {
            startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
        }
        binding.textLocationStatus.setOnClickListener {
            startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
        }

        viewModel.onThreatsFound = { flagged, total ->
            NotificationHelper.notifyThreats(this, flagged, total)
        }

        observeViewModel()
        updateStatusBanner()
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
                .show()
        }
    }

    private fun showSnackbar(resId: Int) {
        Snackbar.make(binding.root, resId, Snackbar.LENGTH_LONG).show()
    }

    private fun showSnackbar(message: String) {
        Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG).show()
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


