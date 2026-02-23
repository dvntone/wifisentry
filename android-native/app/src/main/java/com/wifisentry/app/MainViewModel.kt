package com.wifisentry.app

import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wifisentry.core.ScanRecord
import com.wifisentry.core.ScanStorage
import com.wifisentry.core.ScannedNetwork
import com.wifisentry.core.ThreatAnalyzer
import com.wifisentry.core.WifiScanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainViewModel(
    private val wifiScanner: WifiScanner,
    private val threatAnalyzer: ThreatAnalyzer,
    private val storage: ScanStorage
) : ViewModel() {

    private val _networks = MutableLiveData<List<ScannedNetwork>>()
    val networks: LiveData<List<ScannedNetwork>> = _networks

    private val _isScanning = MutableLiveData(false)
    val isScanning: LiveData<Boolean> = _isScanning

    private val _scanError = MutableLiveData<String?>()
    val scanError: LiveData<String?> = _scanError

    private val _scanStatus = MutableLiveData<String>()
    val scanStatus: LiveData<String> = _scanStatus

    fun scan(context: Context) {
        viewModelScope.launch {
            _isScanning.value = true
            _scanError.value = null
            _networks.value = emptyList()

            withContext(Dispatchers.IO) {
                val started = wifiScanner.startScan()
                if (!started) {
                    withContext(Dispatchers.Main) {
                        _scanError.value = "Scan could not be started. Check that Wi-Fi is enabled."
                        _isScanning.value = false
                    }
                    return@withContext
                }
                // Small wait to allow the system scan to complete before reading cached results
                Thread.sleep(2000)

                val raw = wifiScanner.getLatestResults()
                val history = storage.loadHistory()
                val analysed = threatAnalyzer.analyze(raw, history)

                if (analysed.isNotEmpty()) {
                    val record = ScanRecord(
                        timestampMs = System.currentTimeMillis(),
                        networks = analysed
                    )
                    storage.appendRecord(record)
                }

                withContext(Dispatchers.Main) {
                    if (analysed.isEmpty()) {
                        _scanError.value =
                            "No networks found. Ensure location services are enabled and try again."
                    }
                    _networks.value = analysed
                    _scanStatus.value = if (analysed.isEmpty()) "" else
                        "Found ${analysed.size} network(s), ${analysed.count { it.isFlagged }} flagged"
                    _isScanning.value = false
                }
            }
        }
    }

    fun isWifiEnabled(): Boolean = wifiScanner.isWifiEnabled()

    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

    fun isLocationEnabled(context: Context): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }
}
