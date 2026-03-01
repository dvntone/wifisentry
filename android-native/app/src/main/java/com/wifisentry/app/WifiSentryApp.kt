package com.wifisentry.app

import android.app.Application
import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Custom Application class.
 *
 * Responsibilities:
 * 1. Install a global uncaught-exception handler that writes the full stack
 *    trace to [CRASH_FILE] before re-throwing to the OS.  MainActivity reads
 *    this file on the next launch and shows a dismissible crash dialog so the
 *    user (or developer) can copy the diagnostic text without needing adb/logcat.
 *
 * 2. Provide [lastCrashReport] so that callers can retrieve and then delete
 *    the saved report atomically.
 */
class WifiSentryApp : Application() {

    override fun onCreate() {
        super.onCreate()
        installCrashHandler()
        // Register the notification channel at the application level for safety.
        NotificationHelper.createChannel(this)
    }

    // ── crash handler ──────────────────────────────────────────────────────

    private fun installCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                saveCrashReport(this, throwable)
            } catch (_: Exception) {
                // If we can't save the report, don't swallow the original crash.
            }
            // Delegate to the OS handler so the system gets the normal crash
            // signal (process termination, Android vitals reporting, etc.).
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    companion object {

        private const val CRASH_FILE = "last_crash.txt"

        /**
         * Write a timestamped crash report to private app storage.
         * Called from the uncaught-exception handler — keep this allocation-free
         * and avoid any Android UI calls (window may be gone at this point).
         */
        fun saveCrashReport(context: Context, throwable: Throwable) {
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            val ts = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            val report = buildString {
                appendLine("Wi-Fi Sentry crash report — $ts")
                appendLine("Thread: ${Thread.currentThread().name}")
                appendLine()
                append(sw.toString())
            }
            File(context.filesDir, CRASH_FILE).writeText(report)
        }

        /**
         * Returns the text of the last saved crash report and deletes the file,
         * or null when no crash has been recorded since the last read.
         *
         * The rename-then-read pattern makes this effectively atomic: the file is
         * moved to a temp name before reading so a second concurrent caller will
         * see no file and return null rather than racing on the same content.
         */
        fun consumeCrashReport(context: Context): String? {
            val file = File(context.filesDir, CRASH_FILE)
            if (!file.exists()) return null
            val tmp = File(context.filesDir, "$CRASH_FILE.reading")
            return try {
                // Atomic rename: only one caller wins the rename; the other sees no file.
                if (!file.renameTo(tmp)) return null
                val text = tmp.readText()
                tmp.delete()
                text.ifBlank { null }
            } catch (_: Exception) {
                tmp.delete()
                null
            }
        }
    }
}
