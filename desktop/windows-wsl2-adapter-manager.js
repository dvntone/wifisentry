/**
 * Windows WSL2 WiFi Adapter Monitor Manager
 * Enables advanced monitoring modes (monitor, promiscuous) on Windows via WSL2
 * Supports various implementation methods including Aircrack-ng suite, Bettercap, and raw packet capture
 * 
 * Prerequisites:
 * - Windows 10/11 with WSL2 enabled
 * - Linux distro installed (Ubuntu recommended)
 * - aircrack-ng, tcpdump, or equivalent tools installed in WSL
 * - Administrator privileges for packet capture
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const os = require('os');

class WindowsWSL2AdapterManager {
  constructor() {
    this.adapters = [];
    this.activeMonitorSession = null;
    this.wsl2Available = false;
    this.wslusername = 'root';
    this.wslDistro = 'Ubuntu'; // or 'Debian', 'Kali', etc.
    this.monitoringProcesses = new Map();
    this.supportedTools = {
      aircrack: false,
      tcpdump: false,
      bettercap: false,
      tshark: false,
    };

    this.initializeWSL2();
  }

  /**
   * Sanitize interface name - alphanumeric, hyphens, underscores only
   * @private
   */
  sanitizeInterfaceName(name) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid interface name: ${name}`);
    }
    return name;
  }

  /**
   * Sanitize file path - reject shell metacharacters
   * @private
   */
  sanitizeFilePath(filePath) {
    if (/[;|&$`~!><'"\n\r]/.test(filePath)) {
      throw new Error(`Invalid characters in file path: ${filePath}`);
    }
    return filePath;
  }

  /**
   * Sanitize distro name - alphanumeric, hyphens, underscores, dots
   * @private
   */
  sanitizeDistroName(name) {
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      throw new Error(`Invalid distro name: ${name}`);
    }
    return name;
  }

  /**
   * Sanitize username - alphanumeric, hyphens, underscores
   * @private
   */
  sanitizeUsername(name) {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid username: ${name}`);
    }
    return name;
  }

  /**
   * Sanitize BPF filter - allow valid BPF operators but reject shell metacharacters
   * Valid BPF operators: !, <, >, =, !=, <=, >=, &&, ||, and, or, not
   * @private
   */
  sanitizeBpfFilter(filter) {
    if (!filter || filter.trim() === '') {
      return '';
    }
    // Reject shell metacharacters but allow BPF operators !<>
    if (/[;|&$`~'"\n\r^(){}[\],]/.test(filter)) {
      throw new Error(`Invalid characters in BPF filter: ${filter}`);
    }
    return filter.trim();
  }

  /**
   * Check if WSL2 is available and properly configured
   */
  async initializeWSL2() {
    try {
      // Check if WSL2 is installed and available
      execSync('wsl --list --verbose', { encoding: 'utf-8' });
      this.wsl2Available = true;
      console.log('[WSL2] WSL2 is available and installed');

      // Check for installed distributions
      const output = execSync('wsl --list --verbose', { encoding: 'utf-8' });
      if (output.includes('Ubuntu')) this.wslDistro = 'Ubuntu';
      else if (output.includes('Kali')) this.wslDistro = 'Kali';
      else if (output.includes('Debian')) this.wslDistro = 'Debian';

      // Test available monitoring tools
      await this._checkAvailableTools();
    } catch (error) {
      console.warn('[WSL2] WSL2 not available:', error.message);
      this.wsl2Available = false;
    }
  }

  /**
   * Check which packet capture/monitoring tools are available in WSL2
   * @private
   */
  async _checkAvailableTools() {
    try {
      const tools = {
        aircrack: 'airmon-ng',
        tcpdump: 'tcpdump',
        bettercap: 'bettercap',
        tshark: 'tshark',
      };

      for (const [key, cmd] of Object.entries(tools)) {
        try {
          execSync(`wsl which ${cmd}`, { encoding: 'utf-8' });
          this.supportedTools[key] = true;
          console.log(`[WSL2] Found tool: ${cmd}`);
        } catch (e) {
          this.supportedTools[key] = false;
        }
      }
    } catch (error) {
      console.warn('[WSL2] Error checking tools:', error.message);
    }
  }

  /**
   * Get adapters available for monitor mode
   */
  async getMonitorModeAdapters() {
    if (!this.wsl2Available) {
      return {
        available: false,
        reason: 'WSL2 not available',
        adapters: [],
      };
    }

    try {
      // Use airmon-ng to detect WiFi adapters (via WSL2)
      const output = await this._executeWSLCommand('airmon-ng');

      const adapters = [];
      const lines = output.split('\n');

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          adapters.push({
            interface: parts[0],
            chipset: parts.slice(2).join(' '),
            driver: 'aircrack-ng compatible',
            canMonitor: true,
          });
        }
      }

      return {
        available: true,
        adapters,
        tool: 'aircrack-ng',
      };
    } catch (error) {
      console.error('[WSL2] Error getting monitor adapters:', error.message);
      return {
        available: false,
        reason: error.message,
        adapters: [],
      };
    }
  }

  /**
   * Enable monitor mode on specified adapter via WSL2
   * @param {string} interfaceName - Network interface name (e.g., 'wlan0')
   * @param {string} method - Implementation method: 'aircrack', 'iw', 'iwconfig'
   */
  async enableMonitorMode(interfaceName, method = 'aircrack') {
    if (!this.wsl2Available) {
      throw new Error('WSL2 not available for monitor mode');
    }

    try {
      // Sanitize interface name
      interfaceName = this.sanitizeInterfaceName(interfaceName);

      if (method === 'aircrack' && this.supportedTools.aircrack) {
        // Using airmon-ng (aircrack-ng suite)
        console.log(`[Monitor] Enabling monitor mode on ${interfaceName} via airmon-ng`);

        // Check current status
        const monStatus = await this._executeWSLCommand(`airmon-ng check ${interfaceName}`);
        console.log('[Monitor] Status check:', monStatus);

        // Start monitor mode
        const result = await this._executeWSLCommand(
          `airmon-ng start ${interfaceName}`,
          true // Requires sudo
        );

        // Get monitor interface name (typically interfaceName + 'mon')
        const monitorInterface = `${interfaceName}mon`;

        return {
          success: true,
          method: 'aircrack-ng (airmon-ng)',
          originalInterface: interfaceName,
          monitorInterface,
          capabilities: {
            packetCapture: true,
            channelHopping: true,
            powerControl: true,
            deauthFrames: true, // Can send deauth packets
            freqOffset: true,
            shortPreamble: true,
          },
        };
      } else if (method === 'iw') {
        // Using iw (newer method)
        console.log(`[Monitor] Enabling monitor mode on ${interfaceName} via iw`);

        // Bring interface down
        await this._executeWSLCommand(
          `ip link set ${interfaceName} down`,
          true
        );

        // Set to monitor mode
        await this._executeWSLCommand(
          `iw dev ${interfaceName} set type monitor`,
          true
        );

        // Bring interface up
        await this._executeWSLCommand(
          `ip link set ${interfaceName} up`,
          true
        );

        return {
          success: true,
          method: 'iw',
          originalInterface: interfaceName,
          monitorInterface: interfaceName,
          capabilities: {
            packetCapture: true,
            channelHopping: true,
          },
        };
      } else if (method === 'iwconfig') {
        // Using iwconfig (legacy method, less reliable)
        console.log(`[Monitor] Enabling monitor mode on ${interfaceName} via iwconfig`);

        // Bring interface down
        await this._executeWSLCommand(
          `ip link set ${interfaceName} down`,
          true
        );

        // Set to monitor mode
        await this._executeWSLCommand(
          `iwconfig ${interfaceName} mode Monitor`,
          true
        );

        // Bring interface up
        await this._executeWSLCommand(
          `ip link set ${interfaceName} up`,
          true
        );

        return {
          success: true,
          method: 'iwconfig (legacy)',
          originalInterface: interfaceName,
          monitorInterface: interfaceName,
          capabilities: {
            packetCapture: true,
          },
        };
      } else {
        throw new Error(
          `Method '${method}' not supported or tool not installed`
        );
      }
    } catch (error) {
      console.error('[Monitor] Error enabling monitor mode:', error.message);
      throw error;
    }
  }

  /**
   * Disable monitor mode and return to managed mode
   * @param {string} interfaceName - Network interface name
   * @param {string} method - Implementation method
   */
  async disableMonitorMode(interfaceName, method = 'aircrack') {
    if (!this.wsl2Available) {
      throw new Error('WSL2 not available');
    }

    try {
      if (method === 'aircrack') {
        // Using airmon-ng stop
        const result = await this._executeWSLCommand(
          `airmon-ng stop ${interfaceName}`,
          true
        );
        console.log('[Monitor] Monitor mode disabled via airmon-ng');
        return { success: true, method: 'aircrack-ng' };
      } else if (method === 'iw') {
        // Using iw to set back to managed mode
        await this._executeWSLCommand(
          `ip link set ${interfaceName} down`,
          true
        );
        await this._executeWSLCommand(
          `iw dev ${interfaceName} set type managed`,
          true
        );
        await this._executeWSLCommand(
          `ip link set ${interfaceName} up`,
          true
        );
        console.log('[Monitor] Monitor mode disabled via iw');
        return { success: true, method: 'iw' };
      }
    } catch (error) {
      console.error('[Monitor] Error disabling monitor mode:', error.message);
      throw error;
    }
  }

  /**
   * Start packet capture in promiscuous mode
   * @param {string} interfaceName - Network interface name
   * @param {object} options - Capture options
   */
  async startPromiscuousCapture(
    interfaceName,
    options = {
      format: 'pcap', // 'pcap' or 'csv'
      filter: '', // BPF filter (e.g., 'tcp port 80')
      packetCount: 0, // 0 = unlimited
      outputFile: null, // capture to file
    }
  ) {
    if (!this.wsl2Available) {
      throw new Error('WSL2 not available for promiscuous mode');
    }

    try {
      // Sanitize inputs
      interfaceName = this.sanitizeInterfaceName(interfaceName);
      if (options.packetCount && typeof options.packetCount === 'number') {
        options.packetCount = Math.max(1, Math.min(500, options.packetCount));
      }
      if (options.filter) {
        options.filter = this.sanitizeBpfFilter(options.filter);
      }

      if (this.supportedTools.tcpdump) {
        const timestamp = Date.now();
        const outputFile =
          options.outputFile ||
          `/tmp/wifi-sentry-capture-${timestamp}.pcap`;

        // Validate output file path
        this.sanitizeFilePath(outputFile);

        // Build tcpdump arguments as array (no shell interpolation)
        const tcpdumpArgs = ['-i', interfaceName, '-P', 'in'];

        // Add packet count if specified
        if (options.packetCount && options.packetCount > 0) {
          tcpdumpArgs.push('-c', String(options.packetCount));
        }

        // Add BPF filter if specified
        if (options.filter) {
          tcpdumpArgs.push(options.filter);
        }

        // Add output file
        tcpdumpArgs.push('-w', outputFile);

        console.log('[Promiscuous] Starting tcpdump capture');

        const processId = `capture-${timestamp}`;
        this.monitoringProcesses.set(processId, {
          interface: interfaceName,
          tool: 'tcpdump',
          outputFile,
          startTime: new Date(),
          status: 'running',
        });

        // Execute tcpdump in WSL2 (non-blocking, shell-free)
        this._executeWSLCommandDirectAsync(tcpdumpArgs, true);

        return {
          success: true,
          mode: 'promiscuous',
          tool: 'tcpdump',
          processId,
          outputFile,
          interface: interfaceName,
          capabilities: {
            packetCapture: true,
            filtering: true,
            unencryptedDataCapture: true,
            metadataCapture: true,
          },
        };
      } else if (this.supportedTools.bettercap) {
        console.log('[Promiscuous] Using bettercap for packet capture');

        const timestamp = Date.now();
        const processId = `capture-${timestamp}`;

        this.monitoringProcesses.set(processId, {
          interface: interfaceName,
          tool: 'bettercap',
          startTime: new Date(),
          status: 'running',
        });

        // Bettercap provides more advanced features
        const bettercapArgs = ['-iface', interfaceName];
        this._executeWSLCommandDirectAsync(bettercapArgs, true);

        return {
          success: true,
          mode: 'promiscuous',
          tool: 'bettercap',
          processId,
          interface: interfaceName,
          capabilities: {
            packetCapture: true,
            networkMapping: true,
            credentialCapture: true,
            attackSimulation: true,
            filtering: true,
          },
        };
      } else {
        throw new Error(
          'No promiscuous capture tool available (tcpdump or bettercap required)'
        );
      }
    } catch (error) {
      console.error('[Promiscuous] Error starting capture:', error.message);
      throw error;
    }
  }

  /**
   * Stop packet capture
   * @param {string} processId - Process identifier
   */
  async stopPromiscuousCapture(processId) {
    const process = this.monitoringProcesses.get(processId);
    if (!process) {
      throw new Error(`Process ${processId} not found`);
    }

    try {
      // Kill the capture process
      await this._executeWSLCommand('pkill -f tcpdump', true);
      // or await this._executeWSLCommand(`pkill -f bettercap`, true);

      process.status = 'stopped';
      process.endTime = new Date();

      console.log(
        `[Promiscuous] Capture stopped. Output: ${process.outputFile}`
      );

      return {
        success: true,
        processId,
        captureFile: process.outputFile,
        duration: process.endTime - process.startTime,
      };
    } catch (error) {
      console.error('[Promiscuous] Error stopping capture:', error.message);
      throw error;
    }
  }

  /**
   * Get capture file and analyze it
   * @param {string} captureFile - Path to PCAP file
   */
  async analyzeCaptureFile(captureFile) {
    try {
      // Sanitize file path
      captureFile = this.sanitizeFilePath(captureFile);

      // Use tshark to analyze if available
      if (this.supportedTools.tshark) {
        const tsharkArgs = [
          '-r', captureFile,
          '-T', 'fields',
          '-e', 'frame.protocols',
          '-e', 'ip.src',
          '-e', 'ip.dst'
        ];
        const output = await this._executeWSLCommand(tsharkArgs);
        return {
          success: true,
          tool: 'tshark',
          summary: output,
        };
      }

      // Fallback to tcpdump analysis
      const tcpdumpArgs = ['-r', captureFile];
      const output = await this._executeWSLCommand(tcpdumpArgs);
      return {
        success: true,
        tool: 'tcpdump',
        summary: output,
      };
    } catch (error) {
      console.error('[Analysis] Error analyzing capture:', error.message);
      throw error;
    }
  }

  /**
   * Execute command in WSL2 environment (blocking with timeout and output limits)
   * Supports both string commands and array arguments
   * @private
   */
  async _executeWSLCommand(commandOrArgs, useSudo = false) {
    return new Promise((resolve, reject) => {
      try {
        // Validate and sanitize inputs
        const distro = this.sanitizeDistroName(this.wslDistro);
        const user = this.sanitizeUsername(this.wslusername);

        // Build arguments array
        let args = ['-d', distro, '-u', user];
        if (useSudo) {
          args.push('sudo');
        }

        // Handle both string and array command formats
        if (typeof commandOrArgs === 'string') {
          args.push('sh', '-c', commandOrArgs);
        } else if (Array.isArray(commandOrArgs)) {
          args = args.concat(commandOrArgs);
        } else {
          throw new Error('Command must be string or array');
        }

        let stdout = '';
        let stderr = '';
        const maxBuffer = 10 * 1024 * 1024; // 10MB
        let finished = false;

        const child = spawn('wsl', args);

        // Set timeout
        const timeout = setTimeout(() => {
          if (!finished) {
            finished = true;
            child.kill();
            reject(new Error('WSL2 command timeout (30s)'));
          }
        }, 30000);

        child.stdout.on('data', (data) => {
          const str = data.toString();
          stdout += str;
          if (stdout.length > maxBuffer) {
            finished = true;
            clearTimeout(timeout);
            child.kill();
            reject(new Error('WSL2 command output exceeded 10MB limit'));
          }
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
          if ((stdout.length + stderr.length) > maxBuffer) {
            finished = true;
            clearTimeout(timeout);
            child.kill();
            reject(new Error('WSL2 command output exceeded 10MB limit'));
          }
        });

        child.on('close', (code) => {
          if (!finished) {
            finished = true;
            clearTimeout(timeout);

            if (code !== 0) {
              reject(new Error(`WSL2 command failed with exit code ${code}: ${stderr}`));
            } else {
              resolve(stdout.trim());
            }
          }
        });

        child.on('error', (error) => {
          if (!finished) {
            finished = true;
            clearTimeout(timeout);
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute command in WSL2 environment (non-blocking via spawn, shell-free)
   * Prevents shell injection by using wsl ... -- syntax
   * @private
   */
  _executeWSLCommandDirectAsync(commandArgs, useSudo = false) {
    try {
      // Validate and sanitize inputs
      const distro = this.sanitizeDistroName(this.wslDistro);
      const user = this.sanitizeUsername(this.wslusername);

      // Build arguments: wsl -d DISTRO -u USER [sudo] -- cmd arg1 arg2 ...
      const args = ['-d', distro, '-u', user];
      if (useSudo) {
        args.push('sudo');
      }
      args.push('--');

      // Add command arguments (array form prevents shell interpretation)
      if (Array.isArray(commandArgs)) {
        args.push(...commandArgs);
      } else if (typeof commandArgs === 'string') {
        args.push(commandArgs);
      } else {
        throw new Error('Command must be string or array');
      }

      // Spawn with timeout and output limits
      const child = spawn('wsl', args);
      let finished = false;
      let stdout = '';
      let stderr = '';
      const maxBuffer = 10 * 1024 * 1024; // 10MB

      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          child.kill();
          console.warn('[WSL2] Async command timeout after 30s');
        }
      }, 30000);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > maxBuffer) {
          finished = true;
          clearTimeout(timeout);
          child.kill();
          console.warn('[WSL2] Async command output exceeded 10MB limit');
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if ((stdout.length + stderr.length) > maxBuffer) {
          finished = true;
          clearTimeout(timeout);
          child.kill();
          console.warn('[WSL2] Async command output exceeded 10MB limit');
        }
      });

      child.on('close', (code) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          if (code !== 0) {
            console.warn(`[WSL2] Async command exited with code ${code}: ${stderr}`);
          }
        }
      });

      child.on('error', (error) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          console.error('[WSL2] Async command error:', error.message);
        }
      });

      child.unref();
      return child.pid;
    } catch (error) {
      console.error('[WSL2] Failed to execute async command:', error.message);
      throw error;
    }
  }

  /**
   * Execute command in WSL2 asynchronously (non-blocking) - DEPRECATED
   * Use _executeWSLCommandDirectAsync instead for shell-free execution
   * @private
   * @deprecated
   */
  _executeWSLCommandAsync(command, useSudo = false) {
    console.warn('[WSL2] _executeWSLCommandAsync is deprecated, use _executeWSLCommandDirectAsync');
    return this._executeWSLCommandDirectAsync([command], useSudo);
  }

  /**
   * Get capabilities summary
   */
  async getCapabilities() {
    return {
      wsl2Available: this.wsl2Available,
      distribution: this.wslDistro,
      tools: this.supportedTools,
      capabilities: {
        monitorMode: this.supportedTools.aircrack || true,
        promiscuousMode: this.supportedTools.tcpdump || this.supportedTools.bettercap,
        packetCapture: this.supportedTools.tcpdump || this.supportedTools.tshark,
        networkAnalysis: this.supportedTools.tshark,
        advancedAttacks: this.supportedTools.bettercap,
      },
      activeSessions: Array.from(this.monitoringProcesses.entries()).map(
        ([id, proc]) => ({
          processId: id,
          ...proc,
        })
      ),
    };
  }

  /**
   * Install required tools in WSL2 (requires manual user confirmation)
   */
  async installRequiredTools() {
    const recommendations = [];

    if (!this.supportedTools.aircrack) {
      recommendations.push(
        'sudo apt-get install aircrack-ng'
      );
    }
    if (!this.supportedTools.tcpdump) {
      recommendations.push(
        'sudo apt-get install tcpdump'
      );
    }
    if (!this.supportedTools.tshark) {
      recommendations.push(
        'sudo apt-get install wireshark-common'
      );
    }
    if (!this.supportedTools.bettercap) {
      recommendations.push(
        '# Install from: https://www.bettercap.org/installation/ (requires Go)'
      );
    }

    return {
      requiresSetup: recommendations.length > 0,
      instructions: [
        '# Run these commands in WSL2 terminal to set up required tools:',
        'sudo apt-get update',
        ...recommendations,
      ],
    };
  }
}

module.exports = WindowsWSL2AdapterManager;
