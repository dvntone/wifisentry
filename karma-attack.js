/**
 * Karma Attack Detector
 *
 * Draws on heuristics from open-source WiFi sniffer implementations and the
 * Android ThreatAnalyzer to detect two classes of Karma-style attack:
 *
 *  1. Suspicious SSID keyword  – SSID contains a keyword associated with
 *     rogue / honeypot APs (free, guest, public, hotel, pineapple, kali, …)
 *
 *  2. Multi-SSID same OUI      – five or more distinct SSIDs advertised by APs
 *     sharing the same hardware OUI in a single scan, with at least one new
 *     BSSID.  This is the signature of a Wi-Fi Pineapple running Karma mode or
 *     Wi-Fi Marauder "beacon spam / ap list" command.
 *
 * The whitelist approach (checking against a fixed set of "known good" networks)
 * was intentionally removed — it produces high false-positive rates in new
 * environments and provides no meaningful detection signal.
 */

'use strict';

const {
  checkSuspiciousKeyword,
  checkMultiSsidSameOui,
  isOpenSecurity,
  SUSPICIOUS_KEYWORDS,
  MULTI_SSID_OUI_THRESHOLD,
} = require('./wifi-scanner');

/**
 * Detect Karma attack patterns in a list of scanned networks.
 *
 * @param {Array<object>} scannedNetworks  Current scan results from node-wifi
 * @param {Array<object>} history          Recent scan records from the database
 *                                         (optional — omit for legacy behaviour)
 * @returns {Array<object>}  Array of threat findings
 */
function detectKarmaAttack(scannedNetworks, history = []) {
  const suspiciousNetworks = [];
  const knownBssids = new Set(
    history.flatMap(r => r.networks || []).map(n => n.bssid).filter(Boolean)
  );

  for (const network of scannedNetworks) {
    // ── 1. Suspicious SSID keyword ──────────────────────────────────────────
    if (checkSuspiciousKeyword(network.ssid)) {
      const matched = SUSPICIOUS_KEYWORDS.find(
        kw => (network.ssid || '').toLowerCase().includes(kw)
      );
      suspiciousNetworks.push({
        ssid: network.ssid,
        bssid: network.bssid,
        threat: 'Karma Attack / Suspicious Honeypot SSID',
        severity: isOpenSecurity(network.security) ? 'High' : 'Medium',
        reason: `SSID "${network.ssid}" contains suspicious keyword "${matched}"`,
      });
    }

    // ── 2. Multi-SSID same OUI (Pineapple Karma / Marauder beacon spam) ─────
    if (checkMultiSsidSameOui(network, scannedNetworks, knownBssids)) {
      suspiciousNetworks.push({
        ssid: network.ssid,
        bssid: network.bssid,
        threat: 'Pineapple Karma / Marauder Beacon Spam',
        severity: 'High',
        reason: `${MULTI_SSID_OUI_THRESHOLD}+ distinct SSIDs from the same hardware OUI — Pineapple Karma mode or Marauder "ap list" beacon-spam signature`,
      });
    }
  }

  return suspiciousNetworks;
}

module.exports = { detectKarmaAttack };
