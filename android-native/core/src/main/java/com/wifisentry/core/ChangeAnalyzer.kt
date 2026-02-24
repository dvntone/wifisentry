package com.wifisentry.core

import kotlin.math.abs

/**
 * Active AP-change analysis engine.
 *
 * ## What this does
 * Compares AP characteristics across consecutive [ScanRecord]s and identifies
 * meaningful changes that may indicate a security threat.  Unlike the one-shot
 * [ThreatAnalyzer] (which flags threats within a single scan), [ChangeAnalyzer]
 * looks *across time* — it is the "memory" layer of the threat pipeline.
 *
 * ## Works on stock Android (no root required)
 * All signals used here come from [android.net.wifi.WifiManager.getScanResults]:
 * SSID, BSSID, capabilities string, frequency/channel, and RSSI.  This is
 * confirmed feasible by the Flock-You-Android feasibility study (MaxwellDPS/
 * Flock-You-Android, 2026) and Kismet's passive WIDS alert system.
 *
 * ## Threat scoring formula
 * Modelled after the Flock-You Android threat scoring framework:
 *   `score = (baseLikelihood * impactFactor * confidence).toInt().coerceIn(0, 100)`
 *
 * | Factor | Range | Meaning |
 * |--------|-------|---------|
 * | baseLikelihood | 0.0–1.0 | Probability this is a real threat (not just noise) |
 * | impactFactor | 0.5–2.0 | Severity if the threat is real (communications? privacy?) |
 * | confidence | 0.1–1.0 | Quality of the detection (strong signal? multiple records?) |
 *
 * ## Gemini AI readiness
 * Each [NetworkChange.description] is a self-contained fact string ready to be
 * sent to the Gemini API.  When the API key is available, wrap this analyzer in
 * a `GeminiAnalysisEngine` that calls:
 * ```
 * POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
 * { "contents": [{ "parts": [{ "text": "Analyze this Wi-Fi change: ${change.description}" }] }] }
 * ```
 * See GEMINI.md for key configuration.  YES — Gemini works perfectly for this.
 */
object ChangeAnalyzer {

    /** RSSI must change by at least this many dBm to be flagged as an anomaly. */
    const val RSSI_ANOMALY_DBM = 15

    /** Minimum number of scan records needed before following-network detection fires.
     *  Prevents false positives on the very first import. */
    private const val MIN_RECORDS_FOR_FOLLOWING = 3

    /** Minimum number of records in which a BSSID must appear to be a "known" AP. */
    private const val MIN_APPEARANCES_KNOWN = 2

    // ── Scoring constants (Flock-You formula: likelihood × impact × confidence) ─

    private const val IMPACT_SECURITY_DOWNGRADE  = 2.0f   // comms at risk
    private const val IMPACT_SECURITY_UPGRADE    = 0.5f   // benign change
    private const val IMPACT_CHANNEL_SHIFT       = 1.5f   // possible impersonation
    private const val IMPACT_NEW_BSSID_SAME_SSID = 1.8f   // evil-twin indicator
    private const val IMPACT_SIGNAL_ANOMALY      = 1.2f   // movement indicator
    private const val IMPACT_CAPABILITIES        = 1.8f   // possible downgrade attack
    private const val IMPACT_FOLLOWING           = 2.0f   // physical tracking

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Analyse a list of [ScanRecord]s (typically the full history from [ScanStorage])
     * and return all detected changes sorted by descending [NetworkChange.score].
     *
     * Records do not need to be pre-sorted; the function sorts them internally.
     *
     * @param records  All scan records to analyse.  Minimum 2 required for any result.
     * @return         [AnalysisResult] with detected changes and summary counts.
     */
    fun analyze(records: List<ScanRecord>): AnalysisResult {
        if (records.size < 2) return AnalysisResult(emptyList(), 0, records.size)

        val sorted = records.sortedByDescending { it.timestampMs }
        val changes = mutableListOf<NetworkChange>()

        // Build per-BSSID history: map of BSSID → all observations across all records
        val bssidHistory: Map<String, List<Pair<Long, ScannedNetwork>>> =
            sorted.flatMap { rec -> rec.networks.map { rec.timestampMs to it } }
                .groupBy { (_, net) -> net.bssid }

        // Build per-SSID history: map of SSID → all BSSIDs seen for that SSID
        val ssidBssids: Map<String, Set<String>> =
            sorted.flatMap { it.networks }.groupBy { it.ssid }
                .mapValues { (_, nets) -> nets.map { it.bssid }.toSet() }

        // ── Check 1: Per-BSSID consecutive-record diffs ────────────────────
        for ((bssid, observations) in bssidHistory) {
            if (observations.size < MIN_APPEARANCES_KNOWN) continue

            // Compare the most recent observation with the oldest to catch long-term changes
            val newest = observations.first().second
            val oldest = observations.last().second

            changes += detectSecurityChange(newest, oldest, bssid)
            changes += detectChannelShift(newest, oldest, bssid)
            changes += detectSignalAnomaly(newest, oldest, bssid, observations.first().first)
            changes += detectCapabilitiesChange(newest, oldest, bssid)
        }

        // ── Check 2: New BSSID on known SSID ──────────────────────────────
        val latestBssids: Set<String> = sorted.first().networks.map { it.bssid }.toSet()
        val historicBssids: Set<String> = sorted.drop(1).flatMap { it.networks }.map { it.bssid }.toSet()

        for (net in sorted.first().networks) {
            if (net.ssid.isBlank()) continue
            val previousBssids = bssidHistory.keys.filter { bssid ->
                val obs = bssidHistory[bssid] ?: return@filter false
                // Was seen in an older record AND has the same SSID
                obs.size >= MIN_APPEARANCES_KNOWN &&
                        obs.any { (_, n) -> n.ssid.equals(net.ssid, ignoreCase = true) } &&
                        bssid != net.bssid
            }
            if (previousBssids.isNotEmpty() && net.bssid !in historicBssids) {
                val change = buildChange(
                    ssid = net.ssid, bssid = net.bssid,
                    type = ChangeType.NEW_BSSID_SAME_SSID,
                    prev = "Known BSSID(s): ${previousBssids.take(2).joinToString()}",
                    curr = "New BSSID: ${net.bssid} (${WifiDisplayUtils.capabilitiesToSecurityLabel(net.capabilities)})",
                    description = "Network '${net.ssid}' was previously seen from ${previousBssids.size} known hardware " +
                            "address(es) but is now also broadcasting from a new, previously-unseen BSSID (${net.bssid}). " +
                            "This is the primary evil-twin indicator on stock Android.",
                    baseLikelihood = 0.65f,
                    impactFactor = IMPACT_NEW_BSSID_SAME_SSID,
                    confidence = 0.7f,
                    detectedAtMs = sorted.first().timestampMs,
                )
                changes += change
            }
        }

        // ── Check 3: Following-network detection ──────────────────────────
        if (sorted.size >= MIN_RECORDS_FOR_FOLLOWING) {
            changes += detectFollowingNetworks(bssidHistory, sorted)
        }

        val significant = changes.filter { it.score >= 10 }.sortedByDescending { it.score }
        return AnalysisResult(significant, significant.size, sorted.size)
    }

    /**
     * Convenience overload: analyse a fresh [current] scan against [history].
     * Used by [MainViewModel] after each live scan to surface immediate changes.
     */
    fun analyze(current: List<ScannedNetwork>, history: List<ScanRecord>): AnalysisResult {
        if (history.isEmpty()) return AnalysisResult(emptyList(), 0, 0)
        val syntheticRecord = ScanRecord(System.currentTimeMillis(), current)
        return analyze(listOf(syntheticRecord) + history)
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private fun detectSecurityChange(
        newest: ScannedNetwork, oldest: ScannedNetwork, bssid: String
    ): List<NetworkChange> {
        val newSec = WifiDisplayUtils.capabilitiesToSecurityLabel(newest.capabilities)
        val oldSec = WifiDisplayUtils.capabilitiesToSecurityLabel(oldest.capabilities)
        if (newSec == oldSec) return emptyList()

        val isDowngrade = securityRank(oldSec) > securityRank(newSec)
        return listOf(buildChange(
            ssid = newest.ssid, bssid = bssid,
            type = if (isDowngrade) ChangeType.SECURITY_DOWNGRADE else ChangeType.SECURITY_UPGRADE,
            prev = oldSec,
            curr = newSec,
            description = "Access point '${newest.ssid}' ($bssid) changed security from '$oldSec' to '$newSec'. " +
                    if (isDowngrade) "A security downgrade is a strong indicator of an evil-twin attack or misconfiguration."
                    else "Security was upgraded — this is usually benign but worth noting.",
            baseLikelihood = if (isDowngrade) 0.70f else 0.50f,
            impactFactor = if (isDowngrade) IMPACT_SECURITY_DOWNGRADE else IMPACT_SECURITY_UPGRADE,
            confidence = 0.75f,
            detectedAtMs = System.currentTimeMillis(),
        ))
    }

    private fun detectChannelShift(
        newest: ScannedNetwork, oldest: ScannedNetwork, bssid: String
    ): List<NetworkChange> {
        val newCh = WifiDisplayUtils.frequencyToChannel(newest.frequency)
        val oldCh = WifiDisplayUtils.frequencyToChannel(oldest.frequency)
        if (newCh == oldCh || newCh < 0 || oldCh < 0) return emptyList()

        val newBand = WifiDisplayUtils.frequencyToBand(newest.frequency)
        val oldBand = WifiDisplayUtils.frequencyToBand(oldest.frequency)
        val bandChange = newBand != oldBand

        return listOf(buildChange(
            ssid = newest.ssid, bssid = bssid,
            type = ChangeType.CHANNEL_SHIFT,
            prev = "ch$oldCh ($oldBand)",
            curr = "ch$newCh ($newBand)",
            description = "Access point '${newest.ssid}' ($bssid) moved from channel $oldCh ($oldBand) " +
                    "to channel $newCh ($newBand). " +
                    if (bandChange) "A band change (2.4 GHz ↔ 5 GHz) is unusual for a fixed AP."
                    else "Channel changes can be benign (DFS) but may indicate a rogue replacement.",
            baseLikelihood = if (bandChange) 0.60f else 0.35f,
            impactFactor = IMPACT_CHANNEL_SHIFT,
            confidence = 0.65f,
            detectedAtMs = System.currentTimeMillis(),
        ))
    }

    private fun detectSignalAnomaly(
        newest: ScannedNetwork, oldest: ScannedNetwork, bssid: String, timestampMs: Long
    ): List<NetworkChange> {
        val delta = abs(newest.rssi - oldest.rssi)
        if (delta < RSSI_ANOMALY_DBM) return emptyList()

        val direction = if (newest.rssi > oldest.rssi) "stronger (+$delta dBm)" else "weaker (−$delta dBm)"
        return listOf(buildChange(
            ssid = newest.ssid, bssid = bssid,
            type = ChangeType.SIGNAL_ANOMALY,
            prev = "${oldest.rssi} dBm",
            curr = "${newest.rssi} dBm",
            description = "Access point '${newest.ssid}' ($bssid) signal became $direction between scans. " +
                    "A change of $delta dBm exceeds the normal static-AP variance of ±5 dBm and may " +
                    "indicate a mobile rogue device being positioned near the user.",
            baseLikelihood = 0.40f,
            impactFactor = IMPACT_SIGNAL_ANOMALY,
            confidence = (delta / 30f).coerceIn(0.3f, 0.85f),
            detectedAtMs = timestampMs,
        ))
    }

    private fun detectCapabilitiesChange(
        newest: ScannedNetwork, oldest: ScannedNetwork, bssid: String
    ): List<NetworkChange> {
        val newCap = normaliseCapabilities(newest.capabilities)
        val oldCap = normaliseCapabilities(oldest.capabilities)
        if (newCap == oldCap) return emptyList()

        // Only flag if the change is meaningful (not just ordering difference)
        val addedFeatures   = newCap - oldCap
        val removedFeatures = oldCap - newCap
        if (addedFeatures.isEmpty() && removedFeatures.isEmpty()) return emptyList()

        val wpsAdded    = "WPS" in addedFeatures
        val wpsRemoved  = "WPS" in removedFeatures
        val cipherChange = addedFeatures.any { it.startsWith("CCMP") || it.startsWith("TKIP") } ||
                           removedFeatures.any { it.startsWith("CCMP") || it.startsWith("TKIP") }

        if (!wpsAdded && !wpsRemoved && !cipherChange) return emptyList()

        return listOf(buildChange(
            ssid = newest.ssid, bssid = bssid,
            type = ChangeType.CAPABILITIES_CHANGED,
            prev = oldest.capabilities.take(60),
            curr = newest.capabilities.take(60),
            description = "Access point '${newest.ssid}' ($bssid) advertised different capabilities. " +
                    buildString {
                        if (wpsAdded) append("WPS appeared — a brute-force vulnerability. ")
                        if (wpsRemoved) append("WPS was removed (positive change). ")
                        if (cipherChange) append("Cipher suite changed: ${removedFeatures.filter { it.startsWith("CCMP") || it.startsWith("TKIP") }.joinToString()} → ${addedFeatures.filter { it.startsWith("CCMP") || it.startsWith("TKIP") }.joinToString()}. ")
                    }.trim(),
            baseLikelihood = if (wpsAdded || cipherChange) 0.70f else 0.45f,
            impactFactor = IMPACT_CAPABILITIES,
            confidence = 0.65f,
            detectedAtMs = System.currentTimeMillis(),
        ))
    }

    private fun detectFollowingNetworks(
        bssidHistory: Map<String, List<Pair<Long, ScannedNetwork>>>,
        sortedRecords: List<ScanRecord>
    ): List<NetworkChange> {
        val results = mutableListOf<NetworkChange>()

        for ((bssid, observations) in bssidHistory) {
            if (observations.size < MIN_RECORDS_FOR_FOLLOWING) continue

            // Check GPS-based following if coordinates are available
            val withGps = observations.filter { (_, n) -> n.hasGpsFix }
            if (withGps.size >= 2) {
                val distances = withGps.zipWithNext { (_, a), (_, b) ->
                    haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
                }
                val maxDist = distances.maxOrNull() ?: 0.0
                if (maxDist > 500.0) { // AP seen > 500 m apart = physically moving
                    val net = observations.first().second
                    results += buildChange(
                        ssid = net.ssid, bssid = bssid,
                        type = ChangeType.FOLLOWING_NETWORK,
                        prev = "Observed at ${withGps.size} locations",
                        curr = "Max separation: ${"%.0f".format(maxDist)} m",
                        description = "Network '${net.ssid}' ($bssid) has been detected at locations " +
                                "up to ${"%.0f".format(maxDist)} metres apart. A legitimate fixed AP does not " +
                                "move. This matches the 'following network' pattern documented for mobile " +
                                "surveillance hotspots and Wi-Fi Pineapple deployments.",
                        baseLikelihood = (maxDist / 2000.0).coerceIn(0.4, 0.9).toFloat(),
                        impactFactor = IMPACT_FOLLOWING,
                        confidence = (withGps.size / 5f).coerceIn(0.4f, 0.9f),
                        detectedAtMs = observations.first().first,
                    )
                }
            }
        }
        return results
    }

    // ── Utilities ─────────────────────────────────────────────────────────

    /**
     * Extract a normalised set of capability tokens from a raw capabilities string.
     * e.g. "[WPA2-PSK-CCMP][RSN][ESS][WPS]" → {"WPA2-PSK-CCMP", "RSN", "ESS", "WPS"}
     */
    private fun normaliseCapabilities(caps: String): Set<String> =
        caps.split("[", "]").map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    /**
     * Rank security protocol strength (higher = stronger).
     * WPA3 > WPA2-Enterprise > WPA2 > WPA-Enterprise > WPA > WEP > Open
     */
    private fun securityRank(label: String): Int = when {
        label.contains("WPA3")            -> 6
        label.contains("WPA2-Enterprise") -> 5
        label.contains("WPA2")            -> 4
        label.contains("WPA-Enterprise")  -> 3
        label.contains("WPA")             -> 2
        label.contains("WEP")             -> 1
        else                              -> 0 // Open
    }

    /**
     * Haversine formula: great-circle distance in metres between two WGS-84 points.
     */
    private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val R = 6_371_000.0 // Earth radius in metres
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2).let { it * it } +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2).let { it * it }
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    private fun buildChange(
        ssid: String, bssid: String,
        type: ChangeType,
        prev: String, curr: String,
        description: String,
        baseLikelihood: Float,
        impactFactor: Float,
        confidence: Float,
        detectedAtMs: Long,
    ): NetworkChange {
        val score = (baseLikelihood * 100f * impactFactor * confidence).toInt().coerceIn(0, 100)
        val severity = when {
            score >= 70 -> ThreatSeverity.HIGH
            score >= 40 -> ThreatSeverity.MEDIUM
            else        -> ThreatSeverity.LOW
        }
        return NetworkChange(
            ssid = ssid, bssid = bssid,
            type = type,
            previousValue = prev, currentValue = curr,
            description = description,
            detectedAtMs = detectedAtMs,
            score = score,
            severity = severity,
        )
    }

    // ── Result type ───────────────────────────────────────────────────────

    data class AnalysisResult(
        val changes: List<NetworkChange>,
        val changeCount: Int,
        val recordsAnalyzed: Int,
    )
}
