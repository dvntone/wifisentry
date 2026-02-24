/**
 * Port Manager
 *
 * Handles port availability scanning, user-overridable port selection,
 * and Windows Defender Firewall rule management for the backend server.
 *
 * Usage flow:
 *   1. Call findAvailablePort(preferredPort) on startup — returns first free port.
 *   2. Spawn the backend with that port via the PORT env variable.
 *   3. On Windows, call checkFirewallRule(port) to see if a rule exists.
 *   4. If not, surface addFirewallRule(port) to the user — it triggers a UAC prompt.
 *      If UAC is unavailable (CI / no desktop), returns manual instructions instead.
 */

'use strict';

const net     = require('net');
const os      = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const SCAN_START        = 3000;
const SCAN_END          = 3100;
const FIREWALL_RULE_NAME = 'WiFi Sentry Backend';

// ── Port availability ─────────────────────────────────────────────────────────

/**
 * Returns true if the given TCP port is not currently bound on 127.0.0.1.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', ()   => resolve(false));
    server.once('listening',  () => { server.close(); resolve(true); });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Scan ports from SCAN_START to SCAN_END and return the first available one.
 * Tries `preferredPort` first before falling back to the sequential scan.
 *
 * @param {number} [preferredPort=SCAN_START]
 * @returns {Promise<number>}
 */
async function findAvailablePort(preferredPort = SCAN_START) {
  if (await isPortAvailable(preferredPort)) return preferredPort;

  for (let p = SCAN_START; p <= SCAN_END; p++) {
    if (p === preferredPort) continue;
    if (await isPortAvailable(p)) return p;
  }

  throw new Error(
    `No available TCP port found in range ${SCAN_START}–${SCAN_END}. ` +
    'Free a port or restart the application.'
  );
}

// ── Windows Defender Firewall ─────────────────────────────────────────────────

/**
 * Check whether a matching inbound firewall rule already exists for `port`.
 * Returns { exists: boolean, ruleFound: boolean } on Windows,
 * or { exists: true, platform } on non-Windows (no action needed).
 *
 * @param {number} port
 */
async function checkFirewallRule(port) {
  if (os.platform() !== 'win32') {
    return { exists: true, platform: os.platform() };
  }

  try {
    const { stdout } = await execAsync(
      `netsh advfirewall firewall show rule name="${FIREWALL_RULE_NAME}" dir=in`,
      { timeout: 5000 }
    );
    const ruleFound = !stdout.includes('No rules match');
    const portMatch = ruleFound && stdout.includes(String(port));
    return { exists: portMatch, ruleFound };
  } catch {
    return { exists: false, ruleFound: false };
  }
}

/**
 * Add an inbound Windows Defender Firewall rule for `port` via a UAC-elevated
 * PowerShell command.  If elevation is unavailable or declined, returns manual
 * instructions the user can follow instead.
 *
 * @param {number} port
 * @returns {Promise<{success: boolean, message?: string, requiresManual?: boolean, instructions?: string[]}>}
 */
async function addFirewallRule(port) {
  if (os.platform() !== 'win32') {
    return { success: true, message: 'Firewall management not applicable on this platform.' };
  }

  const netshArgs =
    `advfirewall firewall add rule ` +
    `name="${FIREWALL_RULE_NAME}" ` +
    `dir=in action=allow protocol=TCP localport=${port}`;

  // PowerShell Start-Process with -Verb RunAs triggers a UAC elevation prompt.
  const psCommand =
    `Start-Process -FilePath netsh ` +
    `-ArgumentList '${netshArgs}' ` +
    `-Verb RunAs -Wait`;

  try {
    await execAsync(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 30000 });
    return { success: true, message: `Inbound firewall rule added for TCP port ${port}.` };
  } catch (err) {
    // UAC was declined or PowerShell is unavailable — return manual fallback.
    return {
      success:        false,
      requiresManual: true,
      command:        `netsh ${netshArgs}`,
      instructions: [
        'Run the following command as Administrator (Command Prompt or PowerShell):',
        `  netsh ${netshArgs}`,
        '',
        'Or use the GUI:',
        '  1. Open Windows Security → Firewall & network protection',
        '  2. Click "Advanced settings" → Inbound Rules → New Rule',
        `  3. Choose Port → TCP → Specific local ports: ${port}`,
        '  4. Allow the connection → apply to all profiles → name it "WiFi Sentry Backend"',
      ],
      error: err.message,
    };
  }
}

/**
 * Remove the WiFi Sentry inbound firewall rule (elevated PowerShell).
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function removeFirewallRule() {
  if (os.platform() !== 'win32') return { success: true };

  const psCommand =
    `Start-Process -FilePath netsh ` +
    `-ArgumentList 'advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}"' ` +
    `-Verb RunAs -Wait`;

  try {
    await execAsync(`powershell -NoProfile -Command "${psCommand}"`, { timeout: 30000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  isPortAvailable,
  findAvailablePort,
  checkFirewallRule,
  addFirewallRule,
  removeFirewallRule,
  SCAN_START,
  SCAN_END,
  FIREWALL_RULE_NAME,
};
