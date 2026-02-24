/**
 * Evil Twin / Rogue AP Detector
 *
 * Draws on heuristics from open-source WiFi sniffer implementations and the
 * Android ThreatAnalyzer to detect three classes of attack:
 *
 *  1. Classic Evil Twin    – same SSID, multiple BSSIDs (any security)
 *  2. Pineapple Impersonation – open AP whose SSID was previously secured
 *                               with a brand-new BSSID
 *  3. BSSID Near-Clone     – same SSID, same first-four MAC octets, different
 *                             last two (rogue copy pattern)
 *  4. Security Change      – encryption type flipped on a known SSID/BSSID
 *
 * The richer checks (2–4) require scan history; they silently skip when no
 * history is provided so the module remains backwards-compatible.
 */

'use strict';

const {
  checkEvilTwin,
  checkBssidNearClone,
  checkSecurityChange,
  ouiOf,
  first4Octets,
  bandOf,
  isOpenSecurity,
} = require('./wifi-scanner');

/**
 * Detect evil twin and related rogue-AP patterns.
 *
 * @param {Array<object>} scannedNetworks  Current scan results from node-wifi
 * @param {Array<object>} history          Recent scan records from the database
 *                                         (optional — omit for legacy behaviour)
 * @returns {Array<object>}  Array of threat findings
 */
function detectEvilTwin(scannedNetworks, history = []) {
  const suspiciousNetworks = [];
  const knownBssids = new Set(
    history.flatMap(r => r.networks || []).map(n => n.bssid).filter(Boolean)
  );

  // ── 1. Classic Evil Twin: same SSID, multiple BSSIDs ─────────────────────
  const ssidMap = new Map();
  for (const network of scannedNetworks) {
    if (!network.ssid) continue;
    if (!ssidMap.has(network.ssid)) ssidMap.set(network.ssid, []);
    ssidMap.get(network.ssid).push(network);
  }

  for (const [ssid, networks] of ssidMap.entries()) {
    if (networks.length > 1) {
      const bssids = networks.map(n => n.bssid).join(', ');
      suspiciousNetworks.push({
        ssid,
        bssid: networks[0].bssid,
        threat: 'Evil Twin / Rogue Access Point',
        severity: 'High',
        reason: `Multiple access points detected with the same SSID. BSSIDs: ${bssids}`,
        details: networks,
      });
    }
  }

  // ── 2–4. History-aware checks ─────────────────────────────────────────────
  for (const net of scannedNetworks) {
    // Pineapple impersonation: open AP, SSID was previously secured, new BSSID
    if (checkEvilTwin(net, history)) {
      suspiciousNetworks.push({
        ssid: net.ssid,
        bssid: net.bssid,
        threat: 'WiFi Pineapple Impersonation',
        severity: 'Critical',
        reason: `Open AP "${net.ssid}" was previously seen as a secured network — classic Pineapple evil-twin pattern`,
      });
    }

    // BSSID near-clone: same SSID, same 4-octet prefix, different last 2
    if (checkBssidNearClone(net, scannedNetworks, knownBssids)) {
      suspiciousNetworks.push({
        ssid: net.ssid,
        bssid: net.bssid,
        threat: 'BSSID Near-Clone',
        severity: 'High',
        reason: `BSSID ${net.bssid} shares the first four octets with another AP for SSID "${net.ssid}" — possible rogue copy`,
      });
    }

    // Security change: encryption type changed for a known SSID/BSSID
    if (checkSecurityChange(net, history)) {
      suspiciousNetworks.push({
        ssid: net.ssid,
        bssid: net.bssid,
        threat: 'Security Type Changed',
        severity: 'High',
        reason: `"${net.ssid}" (${net.bssid}) previously used different encryption — may indicate a rogue AP`,
      });
    }
  }

  return suspiciousNetworks;
}

module.exports = { detectEvilTwin };
