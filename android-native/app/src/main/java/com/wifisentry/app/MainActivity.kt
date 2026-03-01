// MainActivity.kt implementation

package com.wifisentry.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private var firstLaunch = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Adapter setup and other logic from main
        setupAdapter()

        // Guarded request for Nearby Wifi permission
        if (firstLaunch) {
            requestNearbyWifiPermissionIfNeeded()
        }
    }

    override fun onPostResume() {
        super.onPostResume()
        // Ensure the requestNearbyWifiPermissionIfNeeded is called here
        requestNearbyWifiPermissionIfNeeded()
    }

    private fun requestNearbyWifiPermissionIfNeeded() {
        // Implementation that does not call requestNotificationPermissionIfNeeded() or requestLocationPermissionIfNeeded()
    }

    private fun setupAdapter() {
        // Adapter setup logic
    }
}