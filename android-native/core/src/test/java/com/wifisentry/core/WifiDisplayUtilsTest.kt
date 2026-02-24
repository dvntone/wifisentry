package com.wifisentry.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WifiDisplayUtilsTest {

    // ── rssiToDistanceMeters ──────────────────────────────────────────────

    @Test
    fun `rssiToDistanceMeters returns 1m when rssi equals txPower for 2dot4GHz`() {
        // txPower for 2.4 GHz = -59 dBm; (−59 − (−59)) / 20 = 0 → 10^0 = 1.0 m
        val dist = WifiDisplayUtils.rssiToDistanceMeters(-59, 2412)
        assertEquals(1.0, dist, 0.01)
    }

    @Test
    fun `rssiToDistanceMeters returns 1m when rssi equals txPower for 5GHz`() {
        // txPower for 5 GHz = -65 dBm
        val dist = WifiDisplayUtils.rssiToDistanceMeters(-65, 5180)
        assertEquals(1.0, dist, 0.01)
    }

    @Test
    fun `rssiToDistanceMeters returns 1m when rssi equals txPower for 6GHz`() {
        // txPower for 6 GHz = -68 dBm
        val dist = WifiDisplayUtils.rssiToDistanceMeters(-68, 5955)
        assertEquals(1.0, dist, 0.01)
    }

    @Test
    fun `rssiToDistanceMeters increases as RSSI decreases`() {
        // Weaker signal = farther away
        val near = WifiDisplayUtils.rssiToDistanceMeters(-55, 2412)
        val far  = WifiDisplayUtils.rssiToDistanceMeters(-75, 2412)
        assertTrue("Expected near ($near) < far ($far)", near < far)
    }

    @Test
    fun `rssiToDistanceMeters strong signal 2dot4GHz is less than 10m`() {
        // -59 dBm at 1 m; -39 dBm (20 dB stronger) → 10^((-59-(-39))/20) = 10^(-1) = 0.1 m
        val dist = WifiDisplayUtils.rssiToDistanceMeters(-39, 2412)
        assertTrue("Strong signal should be < 10 m, was $dist", dist < 10.0)
    }

    @Test
    fun `rssiToDistanceMeters falls back to 2dot4GHz txPower for unknown frequency`() {
        // Frequency 0 → fallback txPower -59 dBm
        val known   = WifiDisplayUtils.rssiToDistanceMeters(-59, 2412)
        val unknown = WifiDisplayUtils.rssiToDistanceMeters(-59, 0)
        assertEquals(known, unknown, 0.001)
    }

    // ── formatDistance ────────────────────────────────────────────────────

    @Test
    fun `formatDistance metres under 1000 shows m suffix`() {
        val label = WifiDisplayUtils.formatDistance(42.0, useFeet = false)
        assertTrue("Expected 'm' suffix in '$label'", label.contains("m") && !label.contains("km"))
    }

    @Test
    fun `formatDistance metres at 1000 or over shows km suffix`() {
        val label = WifiDisplayUtils.formatDistance(1500.0, useFeet = false)
        assertTrue("Expected 'km' suffix in '$label'", label.contains("km"))
    }

    @Test
    fun `formatDistance feet shows ft suffix`() {
        val label = WifiDisplayUtils.formatDistance(10.0, useFeet = true)
        assertTrue("Expected 'ft' suffix in '$label'", label.contains("ft"))
    }

    @Test
    fun `formatDistance 1m in feet is approximately 3ft`() {
        val label = WifiDisplayUtils.formatDistance(1.0, useFeet = true)
        // 1 m * 3.28084 ≈ 3 ft; allow rounding to 3 or 4
        assertTrue("Expected ~3 ft, got '$label'",
            label.contains("3") || label.contains("4"))
    }

    @Test
    fun `formatDistance result always starts with tilde`() {
        listOf(
            WifiDisplayUtils.formatDistance(5.0, useFeet = false),
            WifiDisplayUtils.formatDistance(5.0, useFeet = true),
            WifiDisplayUtils.formatDistance(2000.0, useFeet = false),
        ).forEach { label ->
            assertTrue("Expected '~' prefix in '$label'", label.startsWith("~"))
        }
    }
}
