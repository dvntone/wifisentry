/**
 * Electron IPC Handlers for Windows WiFi Adapter Management
 *
 * Exports register(ipcMain, ctx) so main.js can load this as a handler module.
 * Also self-registers when required directly (legacy compatibility).
 */

'use strict';

const { dialog } = require('electron');
const WindowsAdapterManager = require('./windows-adapter-manager');

// Lazily initialised so the manager is only created when the feature is used.
let adapterManager = null;
function getManager() {
  if (!adapterManager) adapterManager = new WindowsAdapterManager();
  return adapterManager;
}

function register(ipcMain, _ctx) {

  ipcMain.handle('get-available-adapters', async () => {
    try {
      const adapters = await getManager().getAvailableAdapters();
      return { success: true, adapters, count: adapters.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-active-adapter', async () => {
    try {
      const adapter = getManager().getActiveAdapter();
      return { success: true, adapter: adapter || { name: 'System Default', isDefault: true } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('select-adapter', async (_event, { name }) => {
    try {
      const adapter = getManager().setActiveAdapter(name);
      return { success: true, message: `Switched to ${adapter.name}`, adapter };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-adapter-details', async (_event, { name }) => {
    try {
      const details = await getManager().getAdapterDetails(name);
      return { success: true, details };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-adapter-stats', async (_event, { name }) => {
    try {
      const stats = await getManager().getAdapterStats(name);
      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-adapter-status', async (_event, { name, enabled }) => {
    try {
      const result = await getManager().setAdapterStatus(name, enabled);
      return { success: result, message: `Adapter ${enabled ? 'enabled' : 'disabled'}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('scan-with-adapter', async (_event, { name }) => {
    try {
      const result = await getManager().scanWithAdapter(name);
      return {
        success: result.success,
        message: result.success ? `Scanning with ${name}` : result.error,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('start-adapter-monitoring', async (_event, interval = 5000) => {
    try {
      getManager().startMonitoring(interval);
      return { success: true, message: 'Adapter monitoring started' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-adapter-monitoring', async () => {
    try {
      getManager().stopMonitoring();
      return { success: true, message: 'Adapter monitoring stopped' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('setup-adapter-updates', async (event) => {
    try {
      getManager().startMonitoring(3000);

      const updateInterval = setInterval(async () => {
        try {
          const adapters     = await getManager().getAvailableAdapters();
          const activeAdapter = getManager().getActiveAdapter();
          event.sender.send('adapter-update', { adapters, activeAdapter, timestamp: new Date() });
        } catch (err) {
          console.error('Error sending adapter update:', err);
        }
      }, 3000);

      // Store so it can be cleared on quit (basic cleanup)
      event.sender.once('destroyed', () => clearInterval(updateInterval));

      return { success: true, message: 'Adapter updates started' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-adapter-config', async () => {
    try {
      const config = getManager().exportConfig();
      const result = await dialog.showSaveDialog({
        title: 'Export Adapter Configuration',
        defaultPath: `wifi-sentry-adapters-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled) return { success: false, message: 'Export cancelled' };

      const { promises: fsP } = require('fs');
      await fsP.writeFile(result.filePath, JSON.stringify(config, null, 2));
      return { success: true, message: 'Configuration exported', path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-adapter-config', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Adapter Configuration',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, message: 'Import cancelled' };
      }

      const { promises: fsP } = require('fs');
      const content = await fsP.readFile(result.filePaths[0], 'utf-8');
      const config  = JSON.parse(content);
      getManager().importConfig(config);
      return { success: true, message: 'Configuration imported', config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Capture backend (monitor mode) ─────────────────────────────────────────

  ipcMain.handle('get-capture-backends', async () => {
    try {
      const caps = await getManager().getCaptureBackends();
      return { success: true, ...caps };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-capture-backend', async (_event, { backend }) => {
    try {
      return { success: true, ...getManager().setCaptureBackend(backend) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-monitor-mode-adapters', async () => {
    try {
      const adapters = await getManager().getMonitorModeAdapters();
      return { success: true, adapters };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('enable-monitor-mode', async (_event, { interfaceName, method }) => {
    try {
      const result = await getManager().enableMonitorMode(interfaceName, method);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('disable-monitor-mode', async (_event, { interfaceName, method }) => {
    try {
      const result = await getManager().disableMonitorMode(interfaceName, method);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-channel', async (_event, { interfaceName, channel }) => {
    try {
      return await getManager().setChannel(interfaceName, channel);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-supported-channels', async (_event, { interfaceName }) => {
    try {
      const channels = await getManager().getSupportedChannels(interfaceName);
      return { success: true, channels };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-capture-setup', async () => {
    try {
      return await getManager().getSetupInstructions();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// When this module is required by main.js via register(), the register()
// call handles self-registration.  The block below is a legacy fallback for
// tooling or test environments that require the file directly without calling
// register() — it is intentionally guarded against the case where Electron's
// ipcMain is not available.
if (require.main !== module) {
  try {
    const { ipcMain: electronIpcMain } = require('electron');
    register(electronIpcMain, {});
  } catch { /* electron not available in test context */ }
}

module.exports = { register, getManager };

