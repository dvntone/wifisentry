/**
 * Simulates the detection of Evil Twin / WiFi Pineapple attacks.
 * In a real-world scenario, this would involve checking for multiple APs
 * with the same SSID but different BSSIDs, encryption types, or signal strengths.
 */
function detectEvilTwin(scannedNetworks) {
  const suspiciousNetworks = [];
  const ssidMap = new Map();

  for (const network of scannedNetworks) {
    if (!ssidMap.has(network.ssid)) {
      ssidMap.set(network.ssid, []);
    }
    ssidMap.get(network.ssid).push(network);
  }

  for (const [ssid, networks] of ssidMap.entries()) {
    if (networks.length > 1) {
      // Simple heuristic: multiple APs with same SSID is suspicious.
      // A real implementation would compare BSSID, security, channel, etc.
      const bssids = networks.map(n => n.bssid).join(', ');
      console.log(`Potential Evil Twin detected for SSID "${ssid}" with BSSIDs: ${bssids}`);
      suspiciousNetworks.push({
        ssid: ssid,
        reason: `Multiple access points detected with the same SSID. BSSIDs: ${bssids}`,
        details: networks,
      });
    }
  }
  return suspiciousNetworks;
}

module.exports = {
  detectEvilTwin,
};