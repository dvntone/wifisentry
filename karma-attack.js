/**
 * Simulates the detection of Karma attacks by identifying suspicious WiFi networks.
 * In a real-world scenario, this would involve analyzing probe requests and responses.
 */

const knownNetworks = new Set(['MyHomeWiFi', 'CorporateNet', 'Public-Library-WiFi']);

/**
 * @param {Array<object>} scannedNetworks - A list of network objects from a scan.
 * @returns {Array<object>} A list of suspicious networks found.
 */
function detectKarmaAttack(scannedNetworks) {
  const suspiciousNetworks = [];
  // A simple heuristic: if a network name is not in the known list, flag it as suspicious.
  // This simulates a device connecting to a network it shouldn't know.
  for (const network of scannedNetworks) {
    if (!knownNetworks.has(network.ssid)) {
      console.log(`Potential Karma attack detected: Suspicious network "${network.ssid}"`);
      suspiciousNetworks.push({
        ssid: network.ssid,
        reason: `Unrecognized network name, potentially a Karma attack honeypot.`,
      });
    }
  }
  return suspiciousNetworks;
}

module.exports = {
  detectKarmaAttack,
};