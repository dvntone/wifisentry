package com.wifisentry.core

/**
 * Data gathered by [RootShellScanner] using elevated shell privileges.
 *
 * An instance with all defaults ([rootActive] = false, counts = 0, sets empty)
 * is used on non-rooted devices so the rest of the analysis pipeline remains
 * root-agnostic — callers never need to branch on root availability.
 */
data class RootScanData(
    /** Number of 802.11 deauth/disassoc frames captured in the last scan window. */
    val deauthFrameCount: Int = 0,

    /**
     * SSIDs seen in probe-response frames but absent from every beacon in the
     * scan.  A rogue device (Pineapple / Karma) answers probe requests for any
     * SSID the client asks for, but never beacons for those SSIDs itself — so
     * these SSIDs appear only in probe-responses, never in beacons.
     */
    val probeOnlySsids: Set<String> = emptySet(),

    /** True when this data was collected with root / monitor mode active. */
    val rootActive: Boolean = false,
)
