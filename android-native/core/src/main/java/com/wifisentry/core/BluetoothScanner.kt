package com.wifisentry.core

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.util.Log

/**
 * Lightweight BLE scanner for detecting nearby Bluetooth devices and potential
 * tracking or spoofing threats.
 */
class BluetoothScanner(private val context: Context) {

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val adapter: BluetoothAdapter? = bluetoothManager?.adapter

    /**
     * Returns true if Bluetooth is enabled on the device.
     */
    fun isEnabled(): Boolean = adapter?.isEnabled == true

    /**
     * Performs a short BLE scan and returns the results via a callback.
     * Note: Requires BLUETOOTH_SCAN permission on Android 12+.
     */
    @SuppressLint("MissingPermission")
    fun scan(durationMs: Long = 5000L, onResults: (List<BluetoothDeviceData>) -> Unit) {
        val scanner = adapter?.bluetoothLeScanner
        if (scanner == null) {
            onResults(emptyList())
            return
        }

        val results = mutableListOf<BluetoothDeviceData>()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val device = result.device
                results.add(BluetoothDeviceData(
                    name = device.name ?: "Unknown",
                    address = device.address,
                    rssi = result.rssi,
                    isConnectable = result.isConnectable
                ))
            }

            override fun onBatchScanResults(batchResults: MutableList<ScanResult>) {
                batchResults.forEach { result ->
                    val device = result.device
                    results.add(BluetoothDeviceData(
                        name = device.name ?: "Unknown",
                        address = device.address,
                        rssi = result.rssi,
                        isConnectable = result.isConnectable
                    ))
                }
            }

            override fun onScanFailed(errorCode: Int) {
                Log.e("BluetoothScanner", "Scan failed with error: $errorCode")
            }
        }

        scanner.startScan(callback)
        
        // Stop scan after duration
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            scanner.stopScan(callback)
            onResults(results.distinctBy { it.address })
        }, durationMs)
    }
}

/**
 * Domain object representing a discovered Bluetooth device.
 */
data class BluetoothDeviceData(
    val name: String,
    val address: String,
    val rssi: Int,
    val isConnectable: Boolean
)
