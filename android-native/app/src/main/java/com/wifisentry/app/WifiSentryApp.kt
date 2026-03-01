package com.wifisentry.app

import android.app.Application
import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class WifiSentryApp : Application() {

    override fun onCreate() {
        super.onCreate()
        
        try {
            NotificationHelper.createNotificationChannel(this)
        } catch (_: Exception) {}

        // Setup global crash handler
        val oldHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            saveCrashReport(this, throwable)
            oldHandler?.uncaughtException(thread, throwable)
        }
    }

    companion object {
        private const val CRASH_FILE = "last_crash.txt"

        fun saveCrashReport(context: Context, throwable: Throwable) {
            try {
                val sw = StringWriter()
                throwable.printStackTrace(PrintWriter(sw))
                val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
                val report = "--- CRASH AT $timestamp ---\n$sw"
                
                val tmp = File(context.filesDir, CRASH_FILE)
                tmp.writeText(report)
            } catch (_: Exception) {}
        }

        fun consumeCrashReport(context: Context): String? {
            val tmp = File(context.filesDir, CRASH_FILE)
            return try {
                if (!tmp.exists()) return null
                val text = tmp.readText()
                tmp.delete()
                text.ifBlank { null }
            } catch (_: Exception) {
                try { tmp.delete() } catch (_: Exception) {}
                null
            }
        }
    }
}
