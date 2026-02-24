package com.wifisentry.core

import java.io.File

/**
 * Detects whether the Android device has root access.
 *
 * Checks are intentionally conservative — they confirm the *su* binary is
 * present and executable but do NOT attempt to run a privileged command.
 * Attempting a privileged command on a freshly-rooted device would trigger a
 * SuperUser / Magisk prompt with no user present to approve it.
 *
 * [isRooted] is computed once (lazy) on first access.  Call it from a
 * background thread to avoid blocking the main thread on slow file-system
 * checks.
 */
object RootChecker {

    /** True when a *su* binary is found in a well-known location or on PATH. */
    val isRooted: Boolean by lazy { detectRoot() }

    private val SU_PATHS = listOf(
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/system/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/data/local/su",
    )

    private fun detectRoot(): Boolean {
        // 1. Check well-known su locations
        if (SU_PATHS.any { File(it).exists() }) return true

        // 2. Check if su is on PATH
        try {
            val p = ProcessBuilder("which", "su")
                .redirectErrorStream(true)
                .start()
            val output = p.inputStream.bufferedReader().readText().trim()
            p.waitFor()
            if (output.isNotEmpty()) return true
        } catch (_: Exception) {}

        // 3. Check for Magisk installation directory
        if (File("/data/adb/magisk").exists()) return true

        return false
    }
}
