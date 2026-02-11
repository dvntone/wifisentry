/**
 * Windows External WiFi Adapter Manager
 * Detects and manages external USB WiFi adapters
 * Works with node-wifi module and supports multiple adapters
 * Supports advanced monitoring modes via WSL2 integration
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const WindowsWSL2AdapterManager = require('./windows-wsl2-adapter-manager');

class WindowsAdapterManager {
  constructor() {
    this.adapters = [];
    this.selectedAdapter = null;
    this.refreshInterval = null;
    this.lastRefresh = null;
    this.wsl2Manager = new WindowsWSL2AdapterManager();
    this.supportsAdvancedModes = false;
    this.monitorMode = false;
    this.promiscuousMode = false;
  }

  /**
   * Get all available WiFi adapters (built-in and external USB)
   */
  async getAvailableAdapters() {
    try {
      const adapters = await this._detectAdapters();
      this.adapters = adapters;
      this.lastRefresh = new Date();
      return adapters;
    } catch (error) {
      console.error('Error detecting adapters:', error.message);
      return [];
    }
  }

  /**
   * Detect adapters using Windows command line tools
   * @private
   */
  async _detectAdapters() {
    const adapters = [];

    try {
      // Get all network adapters using netsh
      const { stdout: netshOutput } = await execAsync(
        'netsh wlan show interfaces'
      );

      // Parse built-in adapters
      const lines = netshOutput.split('\n');
      let currentAdapter = null;

      for (const line of lines) {
        if (line.includes('Interface name')) {
          const match = line.match(/:\s(.+)/);
          if (match) {
            currentAdapter = {
              name: match[1].trim(),
              type: 'built-in',
              status: 'unknown',
              description: 'Built-in WiFi Adapter',
              isExternal: false,
              guid: '',
            };
          }
        } else if (line.includes('State') && currentAdapter) {
          const match = line.match(/:\s(.+)/);
          if (match) {
            currentAdapter.status = match[1].trim().toLowerCase();
            adapters.push(currentAdapter);
            currentAdapter = null;
          }
        }
      }

      // Get external USB adapters from registry
      const externalAdapters = await this._getUSBAdapters();
      adapters.push(...externalAdapters);

      return adapters;
    } catch (error) {
      console.error('Error parsing adapters:', error.message);
      return [];
    }
  }

  /**
   * Detect USB WiFi adapters using WMI queries
   * @private
   */
  async _getUSBAdapters() {
    const adapters = [];

    try {
      // Query USB devices for WiFi adapters using WMI
      const { stdout } = await execAsync(
        'wmic logicaldisk get name',
        { maxBuffer: 10 * 1024 * 1024 }
      );

      // Alternative: Query network adapters with USB bus enumeration
      const { stdout: wmiOutput } = await execAsync(
        'wmic nic where "Description like \'%Wireless%\' or Description like \'%WiFi%\' or Description like \'%802.11%\'" get Name,Description,GUID,ServiceName',
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const lines = wmiOutput.split('\n');

      for (const line of lines) {
        if (line.trim() && !line.includes('Description')) {
          const parts = line.split(/\s{2,}/);
          if (parts.length >= 2) {
            // Heuristic: adapters not in system folder are usually external/USB
            const isLikelyExternal =
              line.includes('USB') ||
              line.includes('Generic') ||
              line.includes('Realtek') ||
              line.includes('TP-Link') ||
              line.includes('ASUS');

            if (isLikelyExternal) {
              adapters.push({
                name: parts[0]?.trim() || 'Unknown',
                description: parts.slice(1).join(' ').trim(),
                type: 'external-usb',
                status: 'connected',
                isExternal: true,
                guid: parts[parts.length - 1]?.trim() || '',
                driver: 'standard',
              });
            }
          }
        }
      }

      return adapters;
    } catch (error) {
      console.error('Error detecting USB adapters:', error.message);
      return [];
    }
  }

  /**
   * Set which adapter to use for scanning
   */
  setActiveAdapter(adapterName) {
    const adapter = this.adapters.find(
      (a) => a.name === adapterName || a.guid === adapterName
    );

    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterName}`);
    }

    this.selectedAdapter = adapter;
    console.log(`✓ Switched to adapter: ${adapter.name}`);

    return adapter;
  }

  /**
   * Get the currently active adapter
   */
  getActiveAdapter() {
    return this.selectedAdapter || this._getDefaultAdapter();
  }

  /**
   * Get default system WiFi adapter if no external adapter is selected
   */
  _getDefaultAdapter() {
    const builtIn = this.adapters.find((a) => !a.isExternal && a.status === 'connected');
    return builtIn || this.adapters[0] || null;
  }

  /**
   * Get adapter details including signal strength and network info
   */
  async getAdapterDetails(adapterName) {
    const adapter = this.adapters.find((a) => a.name === adapterName);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterName}`);
    }

    try {
      const { stdout } = await execAsync(
        `netsh wlan show interface name="${adapterName}"`
      );

      const details = {
        ...adapter,
        signalStrength: this._parseSignalStrength(stdout),
        channel: this._parseChannel(stdout),
        frequency: this._parseFrequency(stdout),
        authentication: this._parseAuthentication(stdout),
        encryption: this._parseEncryption(stdout),
        ssid: this._parseSSID(stdout),
      };

      return details;
    } catch (error) {
      console.error('Error getting adapter details:', error.message);
      return adapter;
    }
  }

  /**
   * Parse signal strength from netsh output
   * @private
   */
  _parseSignalStrength(output) {
    const match = output.match(/Signal\s*:\s*(\d+)%/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse channel from netsh output
   * @private
   */
  _parseChannel(output) {
    const match = output.match(/Channel\s*:\s*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse frequency from netsh output
   * @private
   */
  _parseFrequency(output) {
    const match = output.match(/Receive Rate \(Mbps\)\s*:\s*(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse authentication from netsh output
   * @private
   */
  _parseAuthentication(output) {
    const match = output.match(/Authentication\s*:\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown';
  }

  /**
   * Parse encryption from netsh output
   * @private
   */
  _parseEncryption(output) {
    const match = output.match(/Cipher\s*:\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown';
  }

  /**
   * Parse SSID from netsh output
   * @private
   */
  _parseSSID(output) {
    const match = output.match(/SSID\s*:\s*(\d+\s*:\s*)?(.+)/i);
    return match ? match[2]?.trim() : '';
  }

  /**
   * Enable/disable an adapter
   */
  async setAdapterStatus(adapterName, enabled) {
    try {
      const action = enabled ? 'enable' : 'disable';
      const { stdout } = await execAsync(
        `netsh interface set interface name="${adapterName}" admin=${action}`
      );
      console.log(`✓ Adapter ${action}d: ${adapterName}`);
      return true;
    } catch (error) {
      console.error(`Error changing adapter status:`, error.message);
      return false;
    }
  }

  /**
   * Get scan results from specific adapter
   */
  async scanWithAdapter(adapterName) {
    const adapter = this.adapters.find((a) => a.name === adapterName);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterName}`);
    }

    try {
      // Initiate WiFi scan
      await execAsync(`netsh wlan show networks mode=Bssid interface="${adapterName}"`);
      return { success: true, adapter: adapterName };
    } catch (error) {
      console.error('Error scanning with adapter:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start monitoring adapter availability
   */
  startMonitoring(interval = 5000) {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      await this.getAvailableAdapters();
    }, interval);

    console.log(`✓ Adapter monitoring started (${interval}ms interval)`);
  }

  /**
   * Stop monitoring adapter availability
   */
  stopMonitoring() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    console.log('✓ Adapter monitoring stopped');
  }

  /**
   * Get adapter statistics
   */
  async getAdapterStats(adapterName) {
    try {
      const { stdout } = await execAsync(
        `netsh interface statistics show interface "${adapterName}"`
      );

      return {
        adapter: adapterName,
        stats: stdout,
        parsed: {
          bytesReceived: this._parseMetric(stdout, 'Bytes Received'),
          bytesSent: this._parseMetric(stdout, 'Bytes Sent'),
          packetsReceived: this._parseMetric(stdout, 'Unicast Packets Received'),
          packetsSent: this._parseMetric(stdout, 'Unicast Packets Sent'),
        },
      };
    } catch (error) {
      console.error('Error getting adapter stats:', error.message);
      return null;
    }
  }

  /**
   * Parse metric from output
   * @private
   */
  _parseMetric(output, metricName) {
    const regex = new RegExp(`${metricName}\\s*:\\s*(\\d+)`, 'i');
    const match = output.match(regex);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Export adapter configuration
   */
  exportConfig() {
    return {
      adapters: this.adapters,
      activeAdapter: this.selectedAdapter,
      lastRefresh: this.lastRefresh,
    };
  }

  /**
   * Import adapter configuration
   */
  importConfig(config) {
    if (config.activeAdapter) {
      this.selectedAdapter = config.activeAdapter;
    }
  }

  /**
   * Enable Monitor Mode via WSL2 (advanced packet sniffing)
   * Requires WSL2 with aircrack-ng or similar tools installed
   * @param {string} interfaceName - Network interface to enable monitor mode on
   * @param {string} method - Method to use: 'aircrack', 'iw', 'iwconfig'
   */
  async enableMonitorMode(interfaceName, method = 'aircrack') {
    try {
      if (!this.wsl2Manager.wsl2Available) {
        throw new Error(
          'WSL2 not available. Please install WSL2 and required tools (aircrack-ng, tcpdump)'
        );
      }

      const result = await this.wsl2Manager.enableMonitorMode(
        interfaceName,
        method
      );
      this.monitorMode = true;
      return result;
    } catch (error) {
      console.error('[Windows] Monitor mode error:', error.message);
      throw error;
    }
  }

  /**
   * Disable Monitor Mode via WSL2
   * @param {string} interfaceName - Network interface to disable monitor mode on
   * @param {string} method - Method used to enable monitor mode
   */
  async disableMonitorMode(interfaceName, method = 'aircrack') {
    try {
      const result = await this.wsl2Manager.disableMonitorMode(
        interfaceName,
        method
      );
      this.monitorMode = false;
      return result;
    } catch (error) {
      console.error('[Windows] Error disabling monitor mode:', error.message);
      throw error;
    }
  }

  /**
   * Start Promiscuous Mode Packet Capture via WSL2
   * Used for capturing unencrypted WiFi traffic
   * @param {string} interfaceName - Network interface to capture on
   * @param {object} options - Capture options
   */
  async startPromiscuousCapture(interfaceName, options = {}) {
    try {
      if (!this.wsl2Manager.wsl2Available) {
        throw new Error(
          'WSL2 not available. Please install WSL2 and tcpdump or tshark'
        );
      }

      const result = await this.wsl2Manager.startPromiscuousCapture(
        interfaceName,
        options
      );
      this.promiscuousMode = true;
      return result;
    } catch (error) {
      console.error('[Windows] Promiscuous capture error:', error.message);
      throw error;
    }
  }

  /**
   * Stop Promiscuous Mode Capture
   * @param {string} processId - Process identifier from startPromiscuousCapture
   */
  async stopPromiscuousCapture(processId) {
    try {
      const result = await this.wsl2Manager.stopPromiscuousCapture(processId);
      this.promiscuousMode = false;
      return result;
    } catch (error) {
      console.error('[Windows] Error stopping capture:', error.message);
      throw error;
    }
  }

  /**
   * Analyze captured packet file
   * @param {string} captureFile - Path to PCAP capture file
   */
  async analyzeCaptureFile(captureFile) {
    try {
      return await this.wsl2Manager.analyzeCaptureFile(captureFile);
    } catch (error) {
      console.error('[Windows] Analysis error:', error.message);
      throw error;
    }
  }

  /**
   * Get available monitors mode adapters (via WSL2)
   */
  async getMonitorModeAdapters() {
    try {
      return await this.wsl2Manager.getMonitorModeAdapters();
    } catch (error) {
      console.error('[Windows] Error getting monitor adapters:', error.message);
      return {
        available: false,
        adapters: [],
        error: error.message,
      };
    }
  }

  /**
   * Get system capabilities for advanced modes
   */
  async getCapabilities() {
    try {
      const capabilities = await this.wsl2Manager.getCapabilities();
      this.supportsAdvancedModes =
        capabilities.capabilities.monitorMode ||
        capabilities.capabilities.promiscuousMode;

      return {
        platform: 'Windows',
        adapters: this.adapters,
        activeAdapter: this.selectedAdapter,
        wsl2: capabilities,
        currentModes: {
          monitorMode: this.monitorMode,
          promiscuousMode: this.promiscuousMode,
        },
      };
    } catch (error) {
      return {
        platform: 'Windows',
        adapters: this.adapters,
        error: error.message,
      };
    }
  }

  /**
   * Get setup instructions for advanced modes
   */
  async getSetupInstructions() {
    try {
      return await this.wsl2Manager.installRequiredTools();
    } catch (error) {
      console.error('[Windows] Error getting setup instructions:', error.message);
      return {
        error: error.message,
      };
    }
  }
}

module.exports = WindowsAdapterManager;
