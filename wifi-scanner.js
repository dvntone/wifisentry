const wifi = require('node-wifi');
const { v4: uuidv4 } = require('uuid');
const database = require('./database');

/**
 * Initializes the node-wifi library.
 */
function initialize() {
  try {
    wifi.init({
      iface: null // Let the library choose the default wireless interface
    });
  } catch (error) {
    console.error("Failed to initialize WiFi scanner:", error);
  }
}

/**
 * Scans for available WiFi networks.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of network objects.
 */
async function scan() {
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
 * Detect Evil Twin networks (same SSID, different BSSID)
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
          signal: n.signal_level || n.signal,
        })),
        severity: 'High',
        description: `Multiple networks with identical SSID "${ssid}" detected with different BSSIDs`,
      });
    }
  }

  return evilTwins;
}

/**
 * Detect Karma Attack patterns
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
 * Detect WiFi Pineapple indicators
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
 * Comprehensive threat analysis
 */
async function analyzeThreatPatterns(networks) {
  const threats = {
    evilTwins: detectEvilTwins(networks),
    karmaAttacks: detectKarmaAttacks(networks),
    wiFiPineapples: detectWiFiPineapple(networks),
    allThreats: [],
  };

  threats.allThreats = [
    ...threats.evilTwins,
    ...threats.karmaAttacks,
    ...threats.wiFiPineapples,
  ];

  return threats;
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
        signal: network.signal_level || network.signal || 0,
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
};