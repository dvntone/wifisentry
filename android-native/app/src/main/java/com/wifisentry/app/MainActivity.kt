package com.wifisentry.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        // Removed NotificationHelper.createChannel(this) as it's handled in WifiSentryApp
    }

    override fun onPostResume() {
        super.onPostResume()
        // Keeping the firstLaunch guarded requestNearbyWifiPermissionIfNeeded() here
    }
}