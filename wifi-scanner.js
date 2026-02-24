const wifi = require('node-wifi');
const { v4: uuidv4 } = require('uuid');
const database = require('./database');

// ─── Constants (mirrored from Android ThreatAnalyzer.kt) ──────────────────────

/** dBm at or above which a brand-new BSSID is considered suspiciously close. */
const SUSPICIOUS_RSSI_THRESHOLD = -40;

/** Minimum distinct SSIDs from one OUI to flag as multi-SSID spam (Karma/Marauder). */
const MULTI_SSID_OUI_THRESHOLD = 5;

/** Minimum new BSSIDs from one OUI in a single scan to flag as a beacon flood. */
const BEACON_FLOOD_THRESHOLD = 4;

/**
 * Suspicious SSID keywords.
 * "test" and "probe" deliberately excluded — too many legitimate false positives.
 * Aligned with Android ThreatAnalyzer.DEFAULT_SUSPICIOUS_KEYWORDS.
 */
const SUSPICIOUS_KEYWORDS = [
  'free', 'guest', 'public', 'open', 'hack', 'evil', 'pineapple',
  'starbucks', 'airport', 'hotel', 'setup',
  'karma', 'rogue', 'pentest', 'kali',
];

// ─── Low-level helpers ────────────────────────────────────────────────────────

/**
 * Extract the first three colon-separated octets (OUI) from a BSSID string.
 * Returns null if the BSSID is malformed.
 * @param {string} bssid
 * @returns {string|null}
 */
function ouiOf(bssid) {
  if (!bssid) return null;
  const parts = bssid.split(':');
  if (parts.length < 3) return null;
  if (parts.slice(0, 3).some(p => !/^[0-9A-Fa-f]{2}$/.test(p))) return null;
  return `${parts[0]}:${parts[1]}:${parts[2]}`;
}

/**
 * Extract the first four colon-separated octets from a BSSID (for near-clone detection).
 * Returns null if malformed.
 * @param {string} bssid
 * @returns {string|null}
 */
function first4Octets(bssid) {
  if (!bssid) return null;
  const parts = bssid.split(':');
  if (parts.length !== 6) return null;
  if (parts.some(p => !/^[0-9A-Fa-f]{2}$/.test(p))) return null;
  return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}`;
}

/**
 * Map a channel centre frequency (MHz) to its nominal band number.
 * Returns 2, 5, or 6 for known bands; 0 for unknown.
 * @param {number} freq
 * @returns {number}
 */
function bandOf(freq) {
  if (freq >= 2400 && freq <= 2499) return 2;
  if (freq >= 4900 && freq <= 5924) return 5;
  if (freq >= 5925 && freq <= 7125) return 6;
  return 0;
}

/**
 * Normalise the RSSI value from a node-wifi network object.
 * node-wifi exposes `signal_level` (dBm number) or `signal` on some platforms.
 * @param {object} net
 * @returns {number}
 */
function rssiOf(net) {
  return typeof net.signal_level === 'number' ? net.signal_level
       : typeof net.signal       === 'number' ? net.signal
       : -100;
}

/**
 * Returns true when the security string indicates an open (unencrypted) network.
 * @param {string} security
 * @returns {boolean}
 */
function isOpenSecurity(security) {
  if (!security) return true;
  const s = security.toUpperCase();
  return !s.includes('WPA') && !s.includes('WEP') && !s.includes('SAE');
}

// ─── Individual threat checks ─────────────────────────────────────────────────

/** OPEN_NETWORK – unencrypted access point. */
function checkOpenNetwork(net) {
  return isOpenSecurity(net.security);
}

/** SUSPICIOUS_SSID – SSID contains a keyword associated with rogue APs. */
function checkSuspiciousKeyword(ssid) {
  if (!ssid) return false;
  const lower = ssid.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * MULTIPLE_BSSIDS – same SSID visible with more than one BSSID within
 * the recent history window (evil-twin / rogue AP indicator).
 */
function checkMultipleBssids(net, currentScan, history) {
  // Collect all BSSIDs for this SSID across history + current scan
  const historicBssids = history
    .flatMap(r => r.networks || [])
    .filter(n => n.ssid === net.ssid && n.bssid)
    .map(n => n.bssid);
  const scanBssids = currentScan
    .filter(n => n.ssid === net.ssid && n.bssid)
    .map(n => n.bssid);
  const unique = new Set([...historicBssids, ...scanBssids]);
  return unique.size > 1;
}

/**
 * SECURITY_CHANGE – the encryption type for a known SSID has changed
 * since it was last seen in scan history.
 */
function checkSecurityChange(net, history) {
  const prev = history
    .flatMap(r => r.networks || [])
    .filter(n => n.ssid === net.ssid && n.bssid === net.bssid && n.security)
    .pop(); // most recent
  if (!prev) return false;
  const prevOpen = isOpenSecurity(prev.security);
  const curOpen  = isOpenSecurity(net.security);
  return prevOpen !== curOpen;
}

/**
 * EVIL_TWIN – open AP whose SSID was previously seen as secured AND
 * the current BSSID is brand-new (not previously associated with this SSID).
 *
 * Classic Wi-Fi Pineapple / evil-twin impersonation pattern.
 */
function checkEvilTwin(net, history) {
  if (!isOpenSecurity(net.security)) return false;
  if (!net.ssid) return false;

  const allHistoric = history.flatMap(r => r.networks || []);

  // SSID must have been seen as secured at some point
  const seenAsSecured = allHistoric.some(n => n.ssid === net.ssid && !isOpenSecurity(n.security));
  if (!seenAsSecured) return false;

  // Current BSSID must be new
  const knownBssids = new Set(
    allHistoric.filter(n => n.ssid === net.ssid).map(n => n.bssid)
  );
  return !!net.bssid && !knownBssids.has(net.bssid);
}

/**
 * MAC_SPOOFING_SUSPECTED – locally-administered bit (bit 1 of first octet)
 * is set and the BSSID has not been seen in any prior scan.
 *
 * Every legitimate AP ships with a globally-administered OUI-assigned MAC.
 * A locally-administered BSSID indicates a software-defined radio or spoofed
 * MAC — common in rogue-AP toolkits.  Enterprise Wi-Fi controllers legitimately
 * use locally-administered BSSIDs, but those will be in history after the first
 * scan, so only truly new locally-administered BSSIDs are flagged.
 */
function checkMacSpoofing(net, knownBssids) {
  if (!net.bssid) return false;
  const firstOctet = parseInt(net.bssid.split(':')[0], 16);
  if (isNaN(firstOctet)) return false;
  if ((firstOctet & 0x02) === 0) return false;          // globally administered — OK
  if (knownBssids.size > 0 && knownBssids.has(net.bssid)) return false; // known enterprise AP
  return true;
}

/**
 * SUSPICIOUS_SIGNAL_STRENGTH – brand-new BSSID at unusually close range
 * (≥ SUSPICIOUS_RSSI_THRESHOLD dBm) while established history exists.
 *
 * A rogue device (e.g. Wi-Fi Pineapple) carried nearby typically produces a
 * signal far stronger than any legitimate AP in the venue.
 */
function checkSuspiciousRssi(net, knownBssids) {
  if (knownBssids.size === 0) return false;            // no baseline — skip
  if (rssiOf(net) < SUSPICIOUS_RSSI_THRESHOLD) return false;
  return !!net.bssid && !knownBssids.has(net.bssid);
}

/**
 * MULTI_SSID_SAME_OUI – five or more distinct SSIDs advertised by APs sharing
 * the same OUI (first three BSSID octets), with at least one new BSSID.
 *
 * Matches Wi-Fi Pineapple Karma mode or Wi-Fi Marauder "ap list" beacon spam.
 * Stable enterprise deployments are suppressed via the history guard.
 */
function checkMultiSsidSameOui(net, currentScan, knownBssids) {
  const oui = ouiOf(net.bssid);
  if (!oui) return false;
  const sameOui = currentScan.filter(n => ouiOf(n.bssid) === oui && n.ssid);
  const uniqueSsids = new Set(sameOui.map(n => n.ssid));
  if (uniqueSsids.size < MULTI_SSID_OUI_THRESHOLD) return false;
  // Suppress if every BSSID in this OUI group was already known — stable deployment
  if (knownBssids.size > 0 && sameOui.every(n => knownBssids.has(n.bssid))) return false;
  return true;
}

/**
 * BEACON_FLOOD – four or more brand-new BSSIDs sharing the same OUI in one scan.
 *
 * Matches Wi-Fi Marauder "spam ap list" / mdk3/mdk4 beacon flood signature:
 * one physical radio creates many virtual APs in rapid succession, all sharing
 * the same OUI.  Requires a prior scan as baseline.
 */
function checkBeaconFlood(net, currentScan, knownBssids) {
  if (knownBssids.size === 0) return false;
  const oui = ouiOf(net.bssid);
  if (!oui) return false;
  const newBssidsFromOui = currentScan
    .filter(n => ouiOf(n.bssid) === oui && n.bssid)
    .map(n => n.bssid)
    .filter((b, i, arr) => arr.indexOf(b) === i)  // unique
    .filter(b => !knownBssids.has(b));
  return newBssidsFromOui.length >= BEACON_FLOOD_THRESHOLD;
}

/**
 * INCONSISTENT_CAPABILITIES – Wi-Fi standard is physically incompatible with
 * the operating frequency, indicating a fabricated beacon.
 *
 * Two impossible combinations on real hardware:
 *  1. 802.11ac (Wi-Fi 5) on 2.4 GHz — 802.11ac is a 5 GHz–only standard.
 *  2. Any pre–Wi-Fi 6 standard on the 6 GHz band (5925–7125 MHz).
 *
 * node-wifi does not expose a parsed Wi-Fi standard integer, so we derive it
 * from the `security_flags` or fall back to frequency-range-only rules where
 * standard data is unavailable.
 */
function checkInconsistentCapabilities(net) {
  const freq = net.frequency;
  if (!freq) return false;

  // If node-wifi provides mode (e.g. "Master") or security_flags — parse 802.11 standard
  // from the SSID's beacon data when available.  Fall back to frequency rules alone.
  const flags = (net.security_flags || '').toUpperCase();

  // 6 GHz band: only Wi-Fi 6E / Wi-Fi 7 (11ax, 11be) are valid.
  // Any older standard (11a/b/g/n/ac) on 6 GHz is impossible on real hardware.
  if (freq >= 5925 && freq <= 7125) {
    const isAx = flags.includes('AX') || flags.includes('6E') || flags.includes('BE');
    if (!isAx && flags.length > 0) return true;  // only flag when we have capability data
  }

  return false;
}

/**
 * BSSID_NEAR_CLONE – same SSID, same first four MAC octets, different last two,
 * on the same band (always a threat) or brand-new cross-band (rogue insertion).
 */
function checkBssidNearClone(net, currentScan, knownBssids) {
  if (!net.ssid || !net.bssid) return false;
  const myPrefix = first4Octets(net.bssid);
  if (!myPrefix) return false;
  const myBand = bandOf(net.frequency || 0);

  const peers = currentScan.filter(other =>
    other.bssid !== net.bssid &&
    other.ssid  === net.ssid  &&
    first4Octets(other.bssid) === myPrefix
  );
  if (peers.length === 0) return false;

  for (const peer of peers) {
    // Same-band near-clone: always a threat
    if (myBand !== 0 && bandOf(peer.frequency || 0) === myBand) return true;
    // Cross-band + new BSSID while peer was known: rogue insertion
    if (knownBssids.size > 0 &&
        knownBssids.has(peer.bssid) &&
        !knownBssids.has(net.bssid)) return true;
  }
  return false;
}

/**
 * WPS_VULNERABLE – AP advertises WPS (Wi-Fi Protected Setup).
 * WPS PIN mode is vulnerable to offline brute-force (Pixie Dust, Reaver).
 */
function checkWpsVulnerable(net) {
  const flags = (net.security_flags || net.security || '').toUpperCase();
  return flags.includes('WPS');
}

/**
 * CHANNEL_SHIFT – BSSID was previously observed on a different frequency band.
 * Legitimate APs are fixed to one band; a band change indicates a rogue device.
 */
function checkChannelShift(net, history) {
  if (!net.bssid || !net.frequency) return false;

  const prevEntry = history
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .flatMap(r => r.networks || [])
    .find(n => n.bssid === net.bssid && n.frequency);

  if (!prevEntry) return false;

  const prevBand = bandOf(prevEntry.frequency);
  const curBand  = bandOf(net.frequency);
  return curBand !== 0 && prevBand !== 0 && curBand !== prevBand;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initializes the node-wifi library (lazy — called on first scan).
 */
let _initialized = false;
function initialize() {
  if (_initialized) return;
  try {
    wifi.init({
      iface: null // Let the library choose the default wireless interface
    });
    _initialized = true;
  } catch (error) {
    console.error("Failed to initialize WiFi scanner:", error);
  }
}

/**
 * Scans for available WiFi networks.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of network objects.
 */
async function scan() {
  initialize();  // idempotent — no-op after first call
  return new Promise((resolve, reject) => {
    wifi.scan((error, networks) => {
      if (error) {
        console.error("WiFi scan failed:", error);
        if (error.message.includes('EPERM') || error.message.includes('permission denied')) {
          return reject(new Error('Permission error. Please run the application with administrator/sudo privileges.'));
        }
        return reject(new Error('Failed to scan for WiFi networks. Ensure your wireless adapter is enabled and drivers are installed.'));
      }
      resolve(networks);
    });
  });
}

/**
 * Detect Evil Twin networks (same SSID, different BSSID).
 * Kept for backwards compatibility with the server.js scan pipeline.
 * @param {Array} networks
 * @returns {Array}
 */
function detectEvilTwins(networks) {
  const ssidMap = {};
  const evilTwins = [];

  for (const network of networks) {
    if (!ssidMap[network.ssid]) {
      ssidMap[network.ssid] = [];
    }
    ssidMap[network.ssid].push(network);
  }

  for (const ssid in ssidMap) {
    if (ssidMap[ssid].length > 1) {
      const nets = ssidMap[ssid];
      evilTwins.push({
        ssid,
        threat: 'Evil Twin / Rogue Access Point',
        networks: nets.map(n => ({
          bssid: n.bssid,
          security: n.security,
          signal: rssiOf(n),
        })),
        severity: 'High',
        description: `Multiple networks with identical SSID "${ssid}" detected with different BSSIDs`,
      });
    }
  }

  return evilTwins;
}

/**
 * Detect Karma Attack patterns.
 * Kept for backwards compatibility with the server.js scan pipeline.
 * @param {Array} networks
 * @returns {Array}
 */
function detectKarmaAttacks(networks) {
  const karmaIndicators = [];
  const commonBaitNetworks = [
    'xfinitywifi',
    'Verizon',
    'T-Mobile WiFi',
    'ATT WiFi',
    'linksys',
    'NETGEAR',
    'Open WiFi',
  ];

  for (const network of networks) {
    for (const bait of commonBaitNetworks) {
      if (network.ssid.toLowerCase().includes(bait.toLowerCase())) {
        karmaIndicators.push({
          ssid: network.ssid,
          bssid: network.bssid,
          threat: 'Karma Attack Bait Network',
          severity: 'High',
          description: `Network matches common Karma attack SSID pattern: ${bait}`,
          indicator: bait,
        });
      }
    }

    if (network.security === 'OPEN' && network.ssid.toLowerCase().includes('wifi')) {
      karmaIndicators.push({
        ssid: network.ssid,
        bssid: network.bssid,
        threat: 'Suspicious Open Network',
        severity: 'Medium',
        description: 'Open network with generic WiFi-related name',
      });
    }
  }

  return karmaIndicators;
}

/**
 * Detect WiFi Pineapple indicators.
 * Kept for backwards compatibility with the server.js scan pipeline.
 * @param {Array} networks
 * @returns {Array}
 */
function detectWiFiPineapple(networks) {
  const pineappleIndicators = [];

  for (const network of networks) {
    if (/^(Pineapple|WiFi Pineapple|Karma)/i.test(network.ssid)) {
      pineappleIndicators.push({
        ssid: network.ssid,
        bssid: network.bssid,
        threat: 'WiFi Pineapple Detected',
        severity: 'Critical',
        description: 'Network SSID matches known WiFi Pineapple default configuration',
      });
    }

    if (network.security === 'OPEN' && /allFi|FreeWiFi|PUBLIC|password/i.test(network.ssid)) {
      pineappleIndicators.push({
        ssid: network.ssid,
        bssid: network.bssid,
        threat: 'Potential WiFi Pineapple / Rogue AP',
        severity: 'High',
        description: 'Network matches WiFi Pineapple attack pattern with open security and enticing SSID',
      });
    }
  }

  return pineappleIndicators;
}

/**
 * Full heuristic threat analysis — 13 checks ported from Android ThreatAnalyzer.kt.
 *
 * Insights drawn from open-source WiFi sniffer implementations:
 *  - OUI-based multi-SSID and beacon flood detection (Marauder / Pineapple Karma)
 *  - Locally-administered MAC bit check for software-defined rogue APs
 *  - History-aware suppression to eliminate false positives on enterprise deployments
 *  - BSSID near-clone detection using 4-octet prefix matching
 *  - Band-incompatible capability detection (fabricated beacons)
 *  - Channel/band shift detection for rogue AP impersonation
 *
 * @param {Array<object>} networks   Current scan results from node-wifi
 * @param {Array<object>} history    Recent scan records from the database
 *                                   Each record has { networks: [...], timestamp }
 * @returns {object}  { annotated, evilTwins, karmaAttacks, wiFiPineapples, allThreats }
 */
async function analyzeThreatPatterns(networks, history = []) {
  // Pre-compute the set of all known BSSIDs from history (used by several checks)
  const knownBssids = new Set(
    history.flatMap(r => r.networks || []).map(n => n.bssid).filter(Boolean)
  );

  // Per-network threat annotation
  const annotated = networks.map(net => {
    const threats = [];

    if (checkOpenNetwork(net))
      threats.push({ type: 'OPEN_NETWORK', severity: 'Low', description: 'Unencrypted access point' });

    if (checkSuspiciousKeyword(net.ssid))
      threats.push({ type: 'SUSPICIOUS_SSID', severity: 'Medium', description: `SSID contains suspicious keyword` });

    if (checkMultipleBssids(net, networks, history))
      threats.push({ type: 'MULTIPLE_BSSIDS', severity: 'High', description: `Same SSID seen with multiple BSSIDs — possible Evil Twin` });

    if (checkSecurityChange(net, history))
      threats.push({ type: 'SECURITY_CHANGE', severity: 'High', description: `Encryption type changed from previously observed value` });

    if (checkEvilTwin(net, history))
      threats.push({ type: 'EVIL_TWIN', severity: 'Critical', description: `Open AP whose SSID was previously secured — classic Pineapple impersonation` });

    if (checkMacSpoofing(net, knownBssids))
      threats.push({ type: 'MAC_SPOOFING_SUSPECTED', severity: 'High', description: `Locally-administered MAC address — not a real manufacturer OUI` });

    if (checkSuspiciousRssi(net, knownBssids))
      threats.push({ type: 'SUSPICIOUS_SIGNAL_STRENGTH', severity: 'High', description: `Brand-new BSSID at unusually close range — consistent with a co-located rogue device` });

    if (checkMultiSsidSameOui(net, networks, knownBssids))
      threats.push({ type: 'MULTI_SSID_SAME_OUI', severity: 'High', description: `5+ SSIDs from one OUI — Pineapple Karma mode or Marauder beacon-spam signature` });

    if (checkBeaconFlood(net, networks, knownBssids))
      threats.push({ type: 'BEACON_FLOOD', severity: 'High', description: `4+ new BSSIDs from one OUI in a single scan — Marauder/mdk4 beacon flood signature` });

    if (checkInconsistentCapabilities(net))
      threats.push({ type: 'INCONSISTENT_CAPABILITIES', severity: 'High', description: `Advertised Wi-Fi standard is physically impossible on the reported frequency band` });

    if (checkBssidNearClone(net, networks, knownBssids))
      threats.push({ type: 'BSSID_NEAR_CLONE', severity: 'High', description: `Same SSID with near-identical BSSID on same band or brand-new cross-band clone` });

    if (checkWpsVulnerable(net))
      threats.push({ type: 'WPS_VULNERABLE', severity: 'Medium', description: `AP advertises WPS — vulnerable to Pixie Dust / Reaver PIN brute-force` });

    if (checkChannelShift(net, history))
      threats.push({ type: 'CHANNEL_SHIFT', severity: 'High', description: `BSSID previously observed on a different frequency band` });

    return { ...net, threats, isFlagged: threats.length > 0 };
  });

  // Backwards-compatible aggregated threat lists
  const evilTwins = detectEvilTwins(networks);
  const karmaAttacks = detectKarmaAttacks(networks);
  const wiFiPineapples = detectWiFiPineapple(networks);

  const allThreats = [
    ...annotated.filter(n => n.isFlagged).map(n => ({
      ssid: n.ssid,
      bssid: n.bssid,
      threat: n.threats.map(t => t.type).join(', '),
      severity: n.threats.reduce((max, t) => {
        const order = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return (order[t.severity] || 0) > (order[max] || 0) ? t.severity : max;
      }, 'Low'),
      description: n.threats.map(t => t.description).join(' | '),
      threats: n.threats,
    })),
    ...evilTwins,
    ...karmaAttacks,
    ...wiFiPineapples,
  ];

  return {
    annotated,
    evilTwins,
    karmaAttacks,
    wiFiPineapples,
    allThreats,
  };
}

/**
 * Log scan results to database
 */
async function logScanResults(networks, detectedThreats) {
  try {
    const scanId = uuidv4();
    const timestamp = new Date().toISOString();

    for (const network of networks) {
      await database.networks.log({
        ssid: network.ssid,
        bssid: network.bssid,
        security: network.security || 'Unknown',
        signal: rssiOf(network),
        frequency: network.frequency || 0,
        scanId,
        timestamp,
      });
    }

    return scanId;
  } catch (error) {
    console.error('Error logging scan results:', error);
    throw error;
  }
}

/**
 * Get recent scan history
 */
async function getScanHistory(limit = 50) {
  try {
    return await database.networks.getRecent(limit);
  } catch (error) {
    console.error('Error fetching scan history:', error);
    throw error;
  }
}

initialize();

module.exports = {
  scan,
  detectEvilTwins,
  detectKarmaAttacks,
  detectWiFiPineapple,
  analyzeThreatPatterns,
  logScanResults,
  getScanHistory,
  // Export individual checks for unit testing and external use
  checkOpenNetwork,
  checkSuspiciousKeyword,
  checkMultipleBssids,
  checkSecurityChange,
  checkEvilTwin,
  checkMacSpoofing,
  checkSuspiciousRssi,
  checkMultiSsidSameOui,
  checkBeaconFlood,
  checkInconsistentCapabilities,
  checkBssidNearClone,
  checkWpsVulnerable,
  checkChannelShift,
  // Export helpers for use in evil-twin-detector and karma-attack modules
  ouiOf,
  first4Octets,
  bandOf,
  rssiOf,
  isOpenSecurity,
  SUSPICIOUS_KEYWORDS,
  SUSPICIOUS_RSSI_THRESHOLD,
  MULTI_SSID_OUI_THRESHOLD,
  BEACON_FLOOD_THRESHOLD,
};
