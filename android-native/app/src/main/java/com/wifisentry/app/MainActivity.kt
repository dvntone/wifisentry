package com.wifisentry.app

import android.content.Intent
import android.content.pm.PackageManager
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
import com.google.android.material.snackbar.Snackbar
import com.wifisentry.app.databinding.ActivityMainBinding
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ThreatAnalyzer
import com.wifisentry.core.WifiScanner

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: ScanResultAdapter

    private val viewModel: MainViewModel by viewModels {
        object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                @Suppress("UNCHECKED_CAST")
                return MainViewModel(
                    WifiScanner(applicationContext),
                    ThreatAnalyzer(),
                    ScanStorage(applicationContext)
                ) as T
            }
        }
    }

    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                performScan()
            } else {
                Snackbar.make(
                    binding.root,
                    getString(R.string.permission_denied_message),
                    Snackbar.LENGTH_LONG
                ).show()
            }
            updateStatusBanner()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        adapter = ScanResultAdapter()
        binding.recyclerNetworks.layoutManager = LinearLayoutManager(this)
        binding.recyclerNetworks.adapter = adapter

        binding.buttonScan.setOnClickListener { onScanClicked() }

        binding.buttonHistory.setOnClickListener {
            startActivity(Intent(this, HistoryActivity::class.java))
        }

        binding.textWifiStatus.setOnClickListener {
            startActivity(Intent(Settings.ACTION_WIFI_SETTINGS))
        }

        binding.textLocationStatus.setOnClickListener {
            startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
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
            requestPermissionLauncher.launch(android.Manifest.permission.ACCESS_FINE_LOCATION)
            return
        }
        performScan()
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
            binding.textEmptyState.visibility =
                if (networks.isEmpty()) View.VISIBLE else View.GONE
        }

        viewModel.isScanning.observe(this) { scanning ->
            binding.buttonScan.isEnabled = !scanning
            binding.progressScan.visibility = if (scanning) View.VISIBLE else View.GONE
            if (scanning) {
                binding.textEmptyState.visibility = View.GONE
            }
        }

        viewModel.scanError.observe(this) { error ->
            if (!error.isNullOrBlank()) {
                binding.textEmptyState.text = error
                binding.textEmptyState.visibility = View.VISIBLE
            }
        }

        viewModel.scanStatus.observe(this) { status ->
            binding.textScanStatus.text = status
        }
    }

    private fun updateStatusBanner() {
        val wifiOk = viewModel.isWifiEnabled()
        val permOk = viewModel.hasLocationPermission(this)
        val locOk = viewModel.isLocationEnabled(this)

        binding.textWifiStatus.text = if (wifiOk)
            getString(R.string.status_wifi_on)
        else
            getString(R.string.status_wifi_off)
        binding.textWifiStatus.setTextColor(
            ContextCompat.getColor(this, if (wifiOk) R.color.status_ok else R.color.status_error)
        )

        binding.textPermissionStatus.text = if (permOk)
            getString(R.string.status_permission_granted)
        else
            getString(R.string.status_permission_missing)
        binding.textPermissionStatus.setTextColor(
            ContextCompat.getColor(this, if (permOk) R.color.status_ok else R.color.status_error)
        )

        binding.textLocationStatus.text = if (locOk)
            getString(R.string.status_location_on)
        else
            getString(R.string.status_location_off)
        binding.textLocationStatus.setTextColor(
            ContextCompat.getColor(this, if (locOk) R.color.status_ok else R.color.status_error)
        )

        // Scan button enabled only when everything is ready
        binding.buttonScan.isEnabled =
            wifiOk && permOk && locOk && viewModel.isScanning.value != true
    }
}
