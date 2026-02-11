/**
 * Electron Preload Script
 * Securely exposes APIs to renderer process
 * Runs with elevated privileges but in isolated context
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exposed APIs for use in renderer process
const electronAPI = {
  // System info
  getStatus: () => ipcRenderer.invoke('get-status'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Monitoring control
  setMonitoring: (enabled) => ipcRenderer.send('set-monitoring', enabled),
  
  // Logging
  getLogs: () => ipcRenderer.invoke('get-logs'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  
  // WiFi Adapter Management
  getAvailableAdapters: () => ipcRenderer.invoke('get-available-adapters'),
  getActiveAdapter: () => ipcRenderer.invoke('get-active-adapter'),
  selectAdapter: (name) => ipcRenderer.invoke('select-adapter', { name }),
  getAdapterDetails: (name) => ipcRenderer.invoke('get-adapter-details', { name }),
  getAdapterStats: (name) => ipcRenderer.invoke('get-adapter-stats', { name }),
  setAdapterStatus: (name, enabled) =>
    ipcRenderer.invoke('set-adapter-status', { name, enabled }),
  scanWithAdapter: (name) =>
    ipcRenderer.invoke('scan-with-adapter', { name }),
  startAdapterMonitoring: () =>
    ipcRenderer.invoke('start-adapter-monitoring'),
  stopAdapterMonitoring: () =>
    ipcRenderer.invoke('stop-adapter-monitoring'),
  setupAdapterUpdates: () =>
    ipcRenderer.invoke('setup-adapter-updates'),
  exportAdapterConfig: (path) =>
    ipcRenderer.invoke('export-adapter-config', { path }),
  importAdapterConfig: (path) =>
    ipcRenderer.invoke('import-adapter-config', { path }),
  
  // WiFi Adapter Event Listeners
  onAdapterUpdate: (callback) => {
    ipcRenderer.on('adapter-update', (event, data) => {
      callback(data);
    });
  },
  onAdapterError: (callback) => {
    ipcRenderer.on('adapter-error', (event, error) => {
      callback(error);
    });
  },
  
  // WiFi scanning
  scanWiFi: () => ipcRenderer.invoke('scan-wifi'),
  getWiFiNetworks: () => ipcRenderer.invoke('get-wifi-networks'),
  startScan: () => ipcRenderer.invoke('start-scan'),
  stopScan: () => ipcRenderer.invoke('stop-scan'),
  
  // WiFi Events
  onWiFiUpdate: (callback) => {
    ipcRenderer.on('wifi-update', (event, networks) => {
      callback(networks);
    });
  },

  // Window control
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) =>
    ipcRenderer.invoke('save-settings', { settings }),
  
  // Events (Legacy)
  onToggleMonitoring: (callback) =>
    ipcRenderer.on('toggle-monitoring', callback),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on('update-downloaded', callback),
  onThreatDetected: (callback) =>
    ipcRenderer.on('threat-detected', (event, data) => callback(data)),
  
  // Install update on quit
  installUpdate: () => ipcRenderer.send('install-update'),
  
  // Platform detection
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development',
};

// Expose to renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Log that preload script loaded
console.log('[Preload] APIs exposed to renderer process');
