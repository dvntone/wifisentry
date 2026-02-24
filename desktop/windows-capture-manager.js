/**
 * Windows Unified Capture Manager
 *
 * Single façade for all 802.11 monitor-mode / packet-capture backends on
 * Windows 8+.  Backends are tried in preference order; the user can also
 * pin a specific backend via setCaptureBackend().
 *
 * Available backends (in default preference order):
 *
 *  1. npcap   — Npcap + WlanHelper.exe   (Win 8+, most compatible)
 *  2. wsl2    — WSL2 + airmon-ng / iw    (Win 10 2004+ only)
 *  3. airpcap — AirPcap USB hardware     (hardware-dependent)
 *  4. vendor  — Vendor-specific drivers  (adapter-dependent)
 *
 * All backends expose the same method surface so callers never need to know
 * which backend is actually running.
 */

const WindowsNpcapManager  = require('./windows-npcap-manager');
const WindowsWSL2AdapterManager = require('./windows-wsl2-adapter-manager');

// Preference order used when backend = 'auto'
const BACKEND_PREFERENCE = ['npcap', 'wsl2', 'airpcap', 'vendor'];

class WindowsCaptureManager {
  constructor() {
    this.npcap  = new WindowsNpcapManager();
    this.wsl2   = new WindowsWSL2AdapterManager();

    /** 'auto' | 'npcap' | 'wsl2' | 'airpcap' | 'vendor' */
    this.preferredBackend = 'auto';

    /** Cache the last full capability matrix so the IPC handler can return it cheaply. */
    this._capabilitiesCache = null;

    this._ready = this._initialize();
  }

  ready() { return this._ready; }

  async _initialize() {
    // Both sub-managers initialise themselves asynchronously; wait for both.
    await Promise.all([
      this.npcap.ready(),
      this.wsl2.initializeWSL2(),
    ]).catch(() => {});
    this._capabilitiesCache = await this._buildCapabilities();
  }

  // ── Capability discovery ────────────────────────────────────────────────────

  /**
   * Returns the full capability matrix for every backend.
   * Shape: { backends: { npcap, wsl2, airpcap, vendor }, recommended, active }
   */
  async getCapabilities() {
    await this._ready;
    this._capabilitiesCache = await this._buildCapabilities();
    return this._capabilitiesCache;
  }

  async _buildCapabilities() {
    const npcapCaps = await this.npcap.getCapabilities().catch(() => ({
      npcap: { available: false }, airpcap: { available: false }, vendorDriver: { count: 0 },
    }));
    const wsl2Caps  = await this.wsl2.getCapabilities().catch(() => ({
      wsl2Available: false, capabilities: {},
    }));

    const backends = {
      npcap: {
        id:           'npcap',
        label:        'Npcap (WlanHelper)',
        description:  'Native Windows packet capture via Npcap + WlanHelper.exe. Best option for Windows 8+.',
        available:    npcapCaps.npcap.available && npcapCaps.npcap.wlanHelper,
        monitorMode:  npcapCaps.npcap.monitorMode,
        packetCapture: npcapCaps.npcap.packetCapture,
        channelControl: npcapCaps.npcap.wlanHelper,
        requiresHardware: false,
        installUrl:   'https://npcap.com',
        details:      npcapCaps.npcap,
      },
      wsl2: {
        id:           'wsl2',
        label:        'WSL2 (airmon-ng / iw)',
        description:  'Linux tools via Windows Subsystem for Linux 2. Requires Win 10 2004+ and usbipd-win for USB passthrough.',
        available:    wsl2Caps.wsl2Available,
        monitorMode:  !!(wsl2Caps.capabilities?.monitorMode),
        packetCapture: !!(wsl2Caps.capabilities?.packetCapture),
        channelControl: !!(wsl2Caps.capabilities?.monitorMode),
        requiresHardware: false,
        installUrl:   'https://learn.microsoft.com/windows/wsl/install',
        details:      wsl2Caps,
      },
      airpcap: {
        id:           'airpcap',
        label:        'AirPcap (hardware driver)',
        description:  'Riverbed/CACE AirPcap USB hardware with dedicated Windows driver. Full 802.11 monitor mode support.',
        available:    npcapCaps.airpcap.available,
        monitorMode:  npcapCaps.airpcap.monitorMode,
        packetCapture: npcapCaps.airpcap.packetCapture,
        channelControl: npcapCaps.airpcap.available,
        requiresHardware: true,
        installUrl:   'https://support.riverbed.com/content/support/software/steelcentral-npm/airpcap.html',
        details:      npcapCaps.airpcap,
      },
      vendor: {
        id:           'vendor',
        label:        'Vendor driver (RTL / AR / MT chipsets)',
        description:  'USB WiFi adapters with Windows vendor drivers that expose monitor mode: RTL8812AU, AR9271, MT7610U, etc.',
        available:    npcapCaps.vendorDriver.count > 0,
        monitorMode:  npcapCaps.vendorDriver.monitorMode,
        packetCapture: npcapCaps.vendorDriver.monitorMode && npcapCaps.npcap.packetCapture,
        channelControl: false,
        requiresHardware: true,
        installUrl:   'https://github.com/aircrack-ng/rtl8812au',
        details:      npcapCaps.vendorDriver,
      },
    };

    // Pick the recommended backend: first available in preference order.
    const recommended = BACKEND_PREFERENCE.find(id => backends[id]?.available) || null;
    const active = this.preferredBackend === 'auto' ? recommended : this.preferredBackend;

    return { backends, recommended, active };
  }

  // ── Backend selection ───────────────────────────────────────────────────────

  /**
   * Pin a specific capture backend.
   * @param {'auto'|'npcap'|'wsl2'|'airpcap'|'vendor'} backend
   */
  setCaptureBackend(backend) {
    const valid = ['auto', ...BACKEND_PREFERENCE];
    if (!valid.includes(backend)) throw new Error(`Unknown backend: ${backend}`);
    this.preferredBackend = backend;
    console.log(`[CaptureManager] Backend set to: ${backend}`);
    return { success: true, backend };
  }

  /**
   * Resolve the active backend id, using capability state.
   * @private
   */
  async _resolveBackend() {
    if (this.preferredBackend !== 'auto') return this.preferredBackend;
    const caps = await this.getCapabilities();
    if (!caps.recommended) throw new Error('No capture backend is available on this system.');
    return caps.recommended;
  }

  // ── Monitor mode ────────────────────────────────────────────────────────────

  /**
   * Enable 802.11 monitor mode on the given interface using the active backend.
   * @param {string} interfaceName  Friendly adapter name (e.g. "WiFi" or "wlan0" for WSL2)
   * @param {string} [method]       Backend-specific sub-method (for WSL2: 'aircrack'|'iw'|'iwconfig')
   */
  async enableMonitorMode(interfaceName, method) {
    const backend = await this._resolveBackend();
    console.log(`[CaptureManager] enableMonitorMode via backend="${backend}" on "${interfaceName}"`);

    switch (backend) {
      case 'npcap':
      case 'airpcap':
      case 'vendor':
        // All of these use WlanHelper under Npcap; vendor adapters need Npcap
        // for capture even if the driver provides the monitor capability itself.
        return this.npcap.enableMonitorMode(interfaceName);

      case 'wsl2':
        return this.wsl2.enableMonitorMode(interfaceName, method || 'aircrack');

      default:
        throw new Error(`Unsupported backend: ${backend}`);
    }
  }

  /**
   * Disable monitor mode and restore managed mode.
   * @param {string} interfaceName
   * @param {string} [method]  WSL2 sub-method if backend is wsl2
   */
  async disableMonitorMode(interfaceName, method) {
    const backend = await this._resolveBackend();
    switch (backend) {
      case 'npcap':
      case 'airpcap':
      case 'vendor':
        return this.npcap.disableMonitorMode(interfaceName);
      case 'wsl2':
        return this.wsl2.disableMonitorMode(interfaceName, method || 'aircrack');
      default:
        throw new Error(`Unsupported backend: ${backend}`);
    }
  }

  // ── Packet capture ──────────────────────────────────────────────────────────

  /**
   * Start a packet capture session.
   * @param {string} interfaceName
   * @param {{outputFile?, filter?, packetCount?, format?}} options
   */
  async startCapture(interfaceName, options = {}) {
    const backend = await this._resolveBackend();
    switch (backend) {
      case 'npcap':
      case 'airpcap':
      case 'vendor':
        return this.npcap.startCapture(interfaceName, options);
      case 'wsl2':
        return this.wsl2.startPromiscuousCapture(interfaceName, options);
      default:
        throw new Error(`Unsupported backend: ${backend}`);
    }
  }

  /**
   * Stop a running capture session.
   * @param {string} processId
   */
  async stopCapture(processId) {
    // Try both backends; only one will have the entry.
    try {
      return await this.npcap.stopCapture(processId);
    } catch {
      return await this.wsl2.stopPromiscuousCapture(processId);
    }
  }

  /**
   * Analyse a capture file.
   * @param {string} captureFile
   */
  async analyzeCaptureFile(captureFile) {
    // Prefer tshark via Npcap; fall back to WSL2 tshark/tcpdump.
    if (this.npcap.tsharkPath) return this.npcap.analyzeCaptureFile(captureFile);
    return this.wsl2.analyzeCaptureFile(captureFile);
  }

  // ── Channel control ─────────────────────────────────────────────────────────

  /**
   * Set the 802.11 channel on a monitor-mode interface.
   * Only supported by the Npcap backend.
   * @param {string} interfaceName
   * @param {number} channel
   */
  async setChannel(interfaceName, channel) {
    return this.npcap.setChannel(interfaceName, channel);
  }

  /**
   * Return the channels supported by an interface.
   * @param {string} interfaceName
   * @returns {Promise<number[]>}
   */
  async getSupportedChannels(interfaceName) {
    return this.npcap.getSupportedChannels(interfaceName);
  }

  // ── Setup guidance ──────────────────────────────────────────────────────────

  /**
   * Return setup instructions covering all backends, including which are
   * already available and which still need installation.
   */
  async getSetupInstructions() {
    await this._ready;
    const [npcapInstructions, wsl2Instructions, caps] = await Promise.all([
      this.npcap.getSetupInstructions(),
      this.wsl2.installRequiredTools(),
      this.getCapabilities(),
    ]);

    return {
      capabilities: caps,
      backends: {
        npcap: npcapInstructions,
        wsl2:  wsl2Instructions,
      },
      summary:
        caps.recommended
          ? `Ready to use — active backend: ${caps.active}`
          : 'No capture backend available. Install Npcap or enable WSL2 to proceed.',
    };
  }
}

module.exports = WindowsCaptureManager;
