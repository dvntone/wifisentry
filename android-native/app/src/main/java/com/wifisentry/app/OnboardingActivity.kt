package com.wifisentry.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.wifisentry.app.databinding.ActivityOnboardingBinding
import com.wifisentry.core.RootChecker

class OnboardingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityOnboardingBinding

    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Permissions requested. App functionalities are naturally toggled off 
        // until user turns them on in the Dashboard.
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        checkEnvironment()

        binding.btnRequestPermissions.setOnClickListener {
            val permissions = mutableListOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                permissions.add(Manifest.permission.BLUETOOTH_SCAN)
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            requestPermissionsLauncher.launch(permissions.toTypedArray())
        }

        binding.btnFinishSetup.setOnClickListener {
            val prefs = getSharedPreferences("settings", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("onboarding_complete", true).apply()
            
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }

    private fun checkEnvironment() {
        // Run a lightweight check to determine if advanced capabilities might be available.
        val hasRoot = RootChecker.getPrivilegedPrefix() != null
        
        val envStatus = buildString {
            appendLine("Root Access: ${if (hasRoot) "✅ Detected" else "❌ Not found"}")
            if (!hasRoot) {
                appendLine("Shizuku / Termux: Needs setup")
            } else {
                appendLine("Advanced Monitor Mode: Available")
            }
            appendLine("\nAll automated scans are disabled by default. You can enable them securely in the Dashboard once setup is complete.")
        }
        binding.tvEnvStatus.text = envStatus
    }
}
