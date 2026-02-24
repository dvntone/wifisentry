/**
 * Electron Preload Script
 * Securely exposes APIs to renderer process
 * Runs with elevated privileges but in isolated context
 */

const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // System info
  getStatus:  () => ipcRenderer.invoke('get-status'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getConfig:  () => ipcRenderer.invoke('get-config'),

  // Monitoring control
  setMonitoring: (enabled) => ipcRenderer.send('set-monitoring', enabled),

  // Logging
  getLogs:    () => ipcRenderer.invoke('get-logs'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),

  // WiFi Adapter Management
  getAvailableAdapters:   () => ipcRenderer.invoke('get-available-adapters'),
  getActiveAdapter:       () => ipcRenderer.invoke('get-active-adapter'),
  selectAdapter:          (name) => ipcRenderer.invoke('select-adapter', { name }),
  getAdapterDetails:      (name) => ipcRenderer.invoke('get-adapter-details', { name }),
  getAdapterStats:        (name) => ipcRenderer.invoke('get-adapter-stats', { name }),
  setAdapterStatus:       (name, enabled) => ipcRenderer.invoke('set-adapter-status', { name, enabled }),
  scanWithAdapter:        (name) => ipcRenderer.invoke('scan-with-adapter', { name }),
  startAdapterMonitoring: () => ipcRenderer.invoke('start-adapter-monitoring'),
  stopAdapterMonitoring:  () => ipcRenderer.invoke('stop-adapter-monitoring'),
  setupAdapterUpdates:    () => ipcRenderer.invoke('setup-adapter-updates'),
  exportAdapterConfig:    () => ipcRenderer.invoke('export-adapter-config'),
  importAdapterConfig:    () => ipcRenderer.invoke('import-adapter-config'),

  // 802.11 Monitor Mode & Capture Backends
  getCaptureBackends:     () => ipcRenderer.invoke('get-capture-backends'),
  setCaptureBackend:      (backend) => ipcRenderer.invoke('set-capture-backend', { backend }),
  getMonitorModeAdapters: () => ipcRenderer.invoke('get-monitor-mode-adapters'),
  enableMonitorMode:      (interfaceName, method) => ipcRenderer.invoke('enable-monitor-mode', { interfaceName, method }),
  disableMonitorMode:     (interfaceName, method) => ipcRenderer.invoke('disable-monitor-mode', { interfaceName, method }),
  setChannel:             (interfaceName, channel) => ipcRenderer.invoke('set-channel', { interfaceName, channel }),
  getSupportedChannels:   (interfaceName) => ipcRenderer.invoke('get-supported-channels', { interfaceName }),
  getCaptureSetup:        () => ipcRenderer.invoke('get-capture-setup'),

  // WiFi Adapter Event Listeners
  onAdapterUpdate: (callback) => ipcRenderer.on('adapter-update', (_event, data) => callback(data)),
  onAdapterError:  (callback) => ipcRenderer.on('adapter-error',  (_event, err)  => callback(err)),

  // WiFi scanning
  scanWiFi:       () => ipcRenderer.invoke('scan-wifi'),
  getWiFiNetworks: () => ipcRenderer.invoke('get-wifi-networks'),
  startScan:      () => ipcRenderer.invoke('start-scan'),
  stopScan:       () => ipcRenderer.invoke('stop-scan'),

  // WiFi Events
  onWiFiUpdate: (callback) => ipcRenderer.on('wifi-update', (_event, networks) => callback(networks)),

  // Window control
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow:    () => ipcRenderer.invoke('close-window'),
  openDevTools:   () => ipcRenderer.invoke('open-dev-tools'),

  // Settings
  getSettings:  () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', { settings }),

  // Events
  onToggleMonitoring: (callback) => ipcRenderer.on('toggle-monitoring', callback),
  onUpdateAvailable:  (callback) => ipcRenderer.on('update-available',  callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onThreatDetected:   (callback) => ipcRenderer.on('threat-detected', (_event, data) => callback(data)),

  // Port management + Windows Defender Firewall
  portCheck:          (port)          => ipcRenderer.invoke('port-check',          { port }),
  portFindAvailable:  (preferredPort) => ipcRenderer.invoke('port-find-available', { preferredPort }),
  portGetCurrent:     ()              => ipcRenderer.invoke('port-get-current'),
  portSet:            (port)          => ipcRenderer.invoke('port-set',            { port }),
  firewallCheck:      (port)          => ipcRenderer.invoke('firewall-check',      port !== undefined ? { port } : undefined),
  firewallAddRule:    (port)          => ipcRenderer.invoke('firewall-add-rule',   port !== undefined ? { port } : undefined),
  firewallRemoveRule: ()              => ipcRenderer.invoke('firewall-remove-rule'),

  // Install update on quit
  installUpdate: () => ipcRenderer.send('install-update'),

  // Platform detection
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development',
};

contextBridge.exposeInMainWorld('electron', electronAPI);

console.log('[Preload] APIs exposed to renderer process');

