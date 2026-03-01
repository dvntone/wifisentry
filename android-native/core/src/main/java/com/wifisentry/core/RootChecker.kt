package com.wifisentry.core

import java.io.File

/**
 * Detects whether the Android device has root access, Shizuku (rish) integration,
 * ADB availability, or Termux environments.
 */
object RootChecker {

    /** True when a *su* binary is found in a well-known location or on PATH. */
    val isRooted: Boolean by lazy { detectRoot() }
    
    /** True when Shizuku's rish binary is found, typically in Termux. */
    val hasShizuku: Boolean by lazy { detectShizuku() }

    /** True when ADB binary is available (e.g. in Termux via android-tools). */
    val hasAdb: Boolean by lazy { detectAdb() }

    /** True when ADB is authorized and connected to at least one device/emulator. */
    val isAdbConnected: Boolean by lazy { checkAdbConnected() }

    /** True when Termux environment is detected. */
    val hasTermux: Boolean by lazy { detectTermux() }

    /** Returns the best available privileged shell prefix (e.g. "su", "-c") or null. */
    fun getPrivilegedPrefix(): List<String>? {
        if (isRooted) return listOf("su", "-c")
        if (hasShizuku) {
            val rishPath = "/data/data/com.termux/files/home/rish"
            try {
                if (File(rishPath).exists()) {
                    return listOf(rishPath, "-c")
                }
            } catch (_: Exception) {}
            return listOf("rish", "-c")
        }
        if (hasAdb && isAdbConnected) return listOf("adb", "shell")
        return null
    }

    private val SU_PATHS = arrayOf(
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/system/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/data/local/su",
        "/data/adb/magisk",
        "/data/adb/ksu"
    )

    private fun detectRoot(): Boolean {
        // 1. Fast path: check well-known su locations using File.exists()
        for (path in SU_PATHS) {
            try {
                if (File(path).exists()) return true
            } catch (_: Exception) {}
        }

        // 2. Fallback: check if su is on PATH
        return isCommandAvailable("su")
    }
    
    private fun detectShizuku(): Boolean {
        return try {
            if (File("/data/data/com.termux/files/home/rish").exists()) return true
            isCommandAvailable("rish")
        } catch (_: Exception) {
            false
        }
    }
    
    private fun detectAdb(): Boolean {
        return isCommandAvailable("adb")
    }

    private fun checkAdbConnected(): Boolean {
        if (!hasAdb) return false
        return try {
            val p = ProcessBuilder("adb", "devices")
                .redirectErrorStream(true)
                .start()
            val output = p.inputStream.bufferedReader().readText().trim()
            p.waitFor()
            // Check if any device is listed as "device" (not "unauthorized", "offline", etc.)
            output.lines().drop(1).any { it.contains("\tdevice") }
        } catch (_: Exception) {
            false
        }
    }
    
    private fun detectTermux(): Boolean {
        return try {
            File("/data/data/com.termux/files/usr/bin/bash").exists() ||
            File("/data/data/com.termux").exists()
        } catch (_: Exception) {
            false
        }
    }

    private fun isCommandAvailable(cmd: String): Boolean = try {
        val p = ProcessBuilder("which", cmd)
            .redirectErrorStream(true)
            .start()
        val exitCode = p.waitFor()
        exitCode == 0
    } catch (_: Exception) {
        false
    }
}
