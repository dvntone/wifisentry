/**
 * Windows Npcap & Vendor Driver Capture Manager
 *
 * Enables 802.11 monitor mode and raw packet capture on Windows 8+ using:
 *
 *  1. Npcap + WlanHelper.exe  — primary native path, no WSL2 needed
 *     https://npcap.com  (free for personal/open-source use, ships with Wireshark)
 *     WlanHelper sets the adapter to monitor mode directly in Windows.
 *
 *  2. AirPcap hardware driver — dedicated USB hardware (Riverbed/CACE AirPcap NX/TX/Classic)
 *     Requires AirPcap USB device + driver package.
 *
 *  3. Vendor-specific drivers — select chipsets ship Windows drivers that expose
 *     monitor mode without needing WSL2 or Npcap:
 *       • Realtek  RTL8187 / RTL8812AU / RTL8811AU / RTL8821AU
 *       • Atheros  AR9271 / AR9380
 *       • Ralink   RT5370 / RT3070
 *       • MediaTek MT7610U / MT7612U / MT7921U
 *     Detection is done via WMI — the driver description is matched against a
 *     known-good list.  Only adapters whose drivers are confirmed to support
 *     monitor mode on Windows are reported as capable.
 *
 * Prerequisites (any one of the above paths):
 *  - Npcap installed with "Support raw 802.11 traffic (monitor mode)" checked
 *    OR Wireshark (bundles Npcap automatically)
 *  - OR AirPcap hardware + driver
 *  - OR USB WiFi adapter with a known monitor-capable chipset and its vendor driver
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ─── Known chipsets whose Windows vendor drivers support monitor mode ─────────
const MONITOR_CAPABLE_CHIPSETS = [
  // Realtek
  'RTL8187', 'RTL8812AU', 'RTL8812BU', 'RTL8811AU', 'RTL8821AU', 'RTL8821CU',
  // Atheros / Qualcomm
  'AR9271', 'AR9380', 'AR9485', 'AR9462',
  // Ralink / MediaTek
  'RT5370', 'RT3070', 'RT2870', 'MT7610U', 'MT7612U', 'MT7921U',
  // Alfa Networks (marketed as monitor-capable on Windows)
  'AWUS036', 'AWUS1900',
];

// ─── Standard Npcap / Wireshark installation paths ───────────────────────────
const NPCAP_WLANHELPER_PATHS = [
  path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'Npcap', 'WlanHelper.exe'),
];

const WIRESHARK_TOOL_DIRS = [
  'C:\\Program Files\\Wireshark',
  'C:\\Program Files (x86)\\Wireshark',
];

class WindowsNpcapManager {
  constructor() {
    this.npcapAvailable      = false;
    this.airpcapAvailable    = false;
    this.wlanHelperPath      = null;
    this.tsharkPath          = null;
    this.dumpcapPath         = null;
    this.captureProcesses    = new Map();
    this.vendorAdapters      = []; // adapters with monitor-capable vendor drivers
    this._ready              = this._initialize();
  }

  /** Wait for the async init to complete before using the manager. */
  ready() { return this._ready; }

  // ── Initialisation ─────────────────────────────────────────────────────────

  async _initialize() {
    await Promise.all([
      this._detectNpcap(),
      this._detectAirPcap(),
      this._detectVendorDriverAdapters(),
    ]);
  }

  /**
   * Detect Npcap service and associated tools (WlanHelper, tshark, dumpcap).
   * @private
   */
  async _detectNpcap() {
    // 1. Check if the Npcap (or legacy WinPcap) service is running.
    for (const svc of ['npcap', 'npf']) {
      try {
        const { stdout } = await execAsync(`sc query ${svc}`, { timeout: 5000 });
        if (stdout.includes('RUNNING') || stdout.includes('STOPPED')) {
          this.npcapAvailable = true;
          console.log(`[Npcap] Service detected: ${svc}`);
          break;
        }
      } catch { /* service not present */ }
    }

    // 2. Locate WlanHelper.exe (Npcap's monitor-mode utility).
    for (const p of NPCAP_WLANHELPER_PATHS) {
      if (fs.existsSync(p)) {
        this.wlanHelperPath = p;
        console.log(`[Npcap] WlanHelper found: ${p}`);
        break;
      }
    }

    // 3. Locate tshark / dumpcap from the Wireshark installation.
    for (const dir of WIRESHARK_TOOL_DIRS) {
      const tshark  = path.join(dir, 'tshark.exe');
      const dumpcap = path.join(dir, 'dumpcap.exe');
      if (fs.existsSync(tshark)) {
        this.tsharkPath  = tshark;
        this.dumpcapPath = fs.existsSync(dumpcap) ? dumpcap : null;
        console.log(`[Npcap] tshark found: ${tshark}`);
        break;
      }
    }

    if (!this.npcapAvailable && this.tsharkPath) {
      // Wireshark is installed — Npcap is bundled with it.
      this.npcapAvailable = true;
      console.log('[Npcap] Detected via Wireshark installation');
    }
  }

  /**
   * Detect AirPcap hardware and driver.
   * @private
   */
  async _detectAirPcap() {
    try {
      const { stdout } = await execAsync('sc query AirPcapNdis', { timeout: 5000 });
      this.airpcapAvailable = stdout.includes('RUNNING') || stdout.includes('STOPPED');
      if (this.airpcapAvailable) console.log('[AirPcap] Driver detected');
    } catch { /* AirPcap not installed */ }

    if (!this.airpcapAvailable) {
      // Secondary check: DLL presence
      const airpcapDll = path.join(
        process.env.SystemRoot || 'C:\\Windows', 'System32', 'airpcap.dll'
      );
      if (fs.existsSync(airpcapDll)) {
        this.airpcapAvailable = true;
        console.log('[AirPcap] DLL detected');
      }
    }
  }

  /**
   * Use WMI to find WiFi adapters whose vendor drivers are known to support
   * monitor mode on Windows.
   * @private
   */
  async _detectVendorDriverAdapters() {
    try {
      const { stdout } = await execAsync(
        'wmic nic where "NetEnabled=TRUE" get Name,Description,ServiceName /format:csv',
        { timeout: 10000, maxBuffer: 5 * 1024 * 1024 }
      );

      for (const line of stdout.split('\n')) {
        const upper = line.toUpperCase();
        const matchedChipset = MONITOR_CAPABLE_CHIPSETS.find(c => upper.includes(c.toUpperCase()));
        if (matchedChipset) {
          const parts = line.split(',');
          const name  = parts[1]?.trim() || 'Unknown';
          if (name && !this.vendorAdapters.some(a => a.name === name)) {
            this.vendorAdapters.push({ name, chipset: matchedChipset, monitorCapable: true });
            console.log(`[VendorDriver] Monitor-capable adapter found: ${name} (${matchedChipset})`);
          }
        }
      }
    } catch (err) {
      console.warn('[VendorDriver] WMI query failed:', err.message);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Returns a capabilities summary for this backend.
   */
  async getCapabilities() {
    await this._ready;
    return {
      npcap: {
        available:      this.npcapAvailable,
        wlanHelper:     !!this.wlanHelperPath,
        tshark:         !!this.tsharkPath,
        dumpcap:        !!this.dumpcapPath,
        monitorMode:    this.npcapAvailable && !!this.wlanHelperPath,
        packetCapture:  this.npcapAvailable && (!!this.tsharkPath || !!this.dumpcapPath),
      },
      airpcap: {
        available:    this.airpcapAvailable,
        monitorMode:  this.airpcapAvailable,
        packetCapture: this.airpcapAvailable,
      },
      vendorDriver: {
        adapters:     this.vendorAdapters,
        count:        this.vendorAdapters.length,
        monitorMode:  this.vendorAdapters.length > 0,
      },
    };
  }

  /**
   * List all Npcap-visible interfaces (equivalent to tshark -D).
   * @returns {Promise<Array<{index, name, description}>>}
   */
  async listInterfaces() {
    if (!this.tsharkPath) return [];
    try {
      const { stdout } = await execAsync(`"${this.tsharkPath}" -D`, { timeout: 10000 });
      return stdout.trim().split('\n').map(line => {
        const m = line.match(/^(\d+)\.\s+(\S+)\s*(.*)?$/);
        return m ? { index: parseInt(m[1]), name: m[2], description: m[3]?.trim() || '' } : null;
      }).filter(Boolean);
    } catch (err) {
      console.error('[Npcap] listInterfaces failed:', err.message);
      return [];
    }
  }

  /**
   * Enable 802.11 monitor mode on a WiFi interface via Npcap WlanHelper.
   * Requires Npcap installed with "Support raw 802.11 traffic" checked.
   *
   * @param {string} interfaceName  Friendly interface name (e.g. "WiFi" or "Wi-Fi 2")
   * @returns {Promise<{success, method, monitorInterface, capabilities}>}
   */
  async enableMonitorMode(interfaceName) {
    await this._ready;
    if (!this.wlanHelperPath) {
      throw new Error(
        'WlanHelper.exe not found. Install Npcap with "Support raw 802.11 traffic" enabled, or install Wireshark.'
      );
    }

    try {
      // Set adapter to monitor mode
      const { stdout } = await execAsync(
        `"${this.wlanHelperPath}" "${interfaceName}" mode monitor`,
        { timeout: 10000 }
      );
      console.log(`[Npcap] Monitor mode enabled on "${interfaceName}": ${stdout.trim()}`);

      return {
        success:          true,
        backend:          'npcap',
        method:           'WlanHelper.exe',
        monitorInterface: interfaceName,
        capabilities: {
          packetCapture:   !!this.tsharkPath,
          channelControl:  true,  // WlanHelper supports channel setting
          channelHopping:  false, // Manual only via WlanHelper
          frameInjection:  false, // Not supported natively via Npcap
        },
      };
    } catch (err) {
      throw new Error(`[Npcap] enableMonitorMode failed: ${err.message}`);
    }
  }

  /**
   * Disable monitor mode and restore managed mode via WlanHelper.
   * @param {string} interfaceName
   */
  async disableMonitorMode(interfaceName) {
    await this._ready;
    if (!this.wlanHelperPath) throw new Error('WlanHelper.exe not found');
    try {
      await execAsync(
        `"${this.wlanHelperPath}" "${interfaceName}" mode managed`,
        { timeout: 10000 }
      );
      console.log(`[Npcap] Restored managed mode on "${interfaceName}"`);
      return { success: true };
    } catch (err) {
      throw new Error(`[Npcap] disableMonitorMode failed: ${err.message}`);
    }
  }

  /**
   * Set the operating channel on a monitor-mode interface.
   * @param {string} interfaceName
   * @param {number} channel  802.11 channel number (1–14 for 2.4 GHz, 36+ for 5 GHz)
   */
  async setChannel(interfaceName, channel) {
    await this._ready;
    if (!this.wlanHelperPath) throw new Error('WlanHelper.exe not found');
    try {
      const { stdout } = await execAsync(
        `"${this.wlanHelperPath}" "${interfaceName}" channel ${channel}`,
        { timeout: 10000 }
      );
      console.log(`[Npcap] Channel set to ${channel} on "${interfaceName}": ${stdout.trim()}`);
      return { success: true, channel };
    } catch (err) {
      throw new Error(`[Npcap] setChannel failed: ${err.message}`);
    }
  }

  /**
   * Get the list of channels supported by an interface.
   * @param {string} interfaceName
   * @returns {Promise<number[]>}
   */
  async getSupportedChannels(interfaceName) {
    await this._ready;
    if (!this.wlanHelperPath) return [];
    try {
      const { stdout } = await execAsync(
        `"${this.wlanHelperPath}" "${interfaceName}" channels`,
        { timeout: 10000 }
      );
      // Output: "1 2 3 4 5 6 7 8 9 10 11 36 40 44 48 ..."
      return stdout.trim().split(/\s+/).map(Number).filter(n => !isNaN(n) && n > 0);
    } catch {
      return [];
    }
  }

  /**
   * Start raw 802.11 packet capture using tshark (via Npcap).
   * The interface should already be in monitor mode via enableMonitorMode().
   *
   * @param {string} interfaceName
   * @param {{outputFile?, filter?, packetCount?}} options
   * @returns {Promise<{success, processId, outputFile, tool}>}
   */
  async startCapture(interfaceName, options = {}) {
    await this._ready;
    if (!this.tsharkPath && !this.dumpcapPath) {
      throw new Error('Neither tshark nor dumpcap found. Install Wireshark to enable packet capture.');
    }

    const tool       = this.tsharkPath || this.dumpcapPath;
    const isTshark   = tool === this.tsharkPath;
    const timestamp  = Date.now();
    const outputFile = options.outputFile ||
      path.join(require('os').tmpdir(), `wifi-sentry-${timestamp}.pcap`);

    const args = ['-i', interfaceName, '-w', outputFile];
    if (isTshark)                     args.push('-q');           // quiet
    if (options.packetCount > 0)      args.push('-c', String(options.packetCount));
    if (options.filter)               args.push('-f', options.filter);

    const child = spawn(`"${tool}"`, args, { shell: true, detached: true, stdio: 'ignore' });
    child.unref();

    const processId = `npcap-${timestamp}`;
    this.captureProcesses.set(processId, {
      pid:        child.pid,
      interface:  interfaceName,
      outputFile,
      tool:       isTshark ? 'tshark' : 'dumpcap',
      startTime:  new Date(),
      status:     'running',
    });

    console.log(`[Npcap] Capture started (pid ${child.pid}) → ${outputFile}`);
    return { success: true, processId, outputFile, tool: isTshark ? 'tshark' : 'dumpcap' };
  }

  /**
   * Stop a running capture by process ID.
   * @param {string} processId
   */
  async stopCapture(processId) {
    const entry = this.captureProcesses.get(processId);
    if (!entry) throw new Error(`Unknown capture process: ${processId}`);

    try {
      if (entry.pid) process.kill(entry.pid, 'SIGTERM');
    } catch { /* process may have already exited */ }

    entry.status  = 'stopped';
    entry.endTime = new Date();

    console.log(`[Npcap] Capture stopped: ${processId} → ${entry.outputFile}`);
    return { success: true, processId, captureFile: entry.outputFile };
  }

  /**
   * Analyse a capture file using tshark.
   * @param {string} captureFile  Path to a .pcap file
   */
  async analyzeCaptureFile(captureFile) {
    if (!this.tsharkPath) throw new Error('tshark not found');
    try {
      const { stdout } = await execAsync(
        `"${this.tsharkPath}" -r "${captureFile}" -T fields ` +
        `-e frame.time -e wlan.sa -e wlan.da -e wlan.ssid -e wlan.fc.type_subtype` +
        ` -E header=y -E separator=, -c 200`,
        { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      );
      return { success: true, tool: 'tshark', summary: stdout };
    } catch (err) {
      throw new Error(`[Npcap] analyzeCaptureFile failed: ${err.message}`);
    }
  }

  /**
   * Returns human-readable setup instructions based on what is and isn't installed.
   */
  async getSetupInstructions() {
    await this._ready;
    const steps = [];

    if (!this.npcapAvailable) {
      steps.push({
        title: 'Install Npcap',
        detail: 'Download from https://npcap.com — check "Support raw 802.11 traffic (monitor mode)" during setup.',
        url: 'https://npcap.com',
        required: true,
      });
    } else if (!this.wlanHelperPath) {
      steps.push({
        title: 'Reinstall Npcap with monitor mode support',
        detail: 'Run the Npcap installer again and enable "Support raw 802.11 traffic (monitor mode)".',
        url: 'https://npcap.com',
        required: true,
      });
    }

    if (!this.tsharkPath) {
      steps.push({
        title: 'Install Wireshark (optional but recommended)',
        detail: 'Provides tshark.exe / dumpcap.exe for packet capture and analysis.',
        url: 'https://www.wireshark.org/download.html',
        required: false,
      });
    }

    if (this.vendorAdapters.length === 0) {
      steps.push({
        title: 'Use a monitor-capable USB WiFi adapter',
        detail:
          'Recommended chipsets with Windows monitor-mode driver support: ' +
          'Alfa AWUS036ACH (RTL8812AU), Alfa AWUS036NHA (AR9271), ' +
          'TP-Link TL-WN722N v1 (AR9271), Ralink RT5370. ' +
          'Install the vendor driver from the manufacturer website.',
        required: false,
      });
    }

    return {
      ready:   this.npcapAvailable && !!this.wlanHelperPath,
      steps,
      vendorAdapters: this.vendorAdapters,
    };
  }
}

module.exports = WindowsNpcapManager;
