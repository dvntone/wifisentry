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
  
  // Events
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
