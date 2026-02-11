/**
 * Electron IPC Handlers for Windows WiFi Adapter Management
 * Extends main.js with adapter selection UI
 */

const { ipcMain, dialog } = require('electron');
const WindowsAdapterManager = require('./windows-adapter-manager');

// Initialize adapter manager
const adapterManager = new WindowsAdapterManager();

/**
 * Get all available adapters
 */
ipcMain.handle('get-available-adapters', async (event) => {
  try {
    const adapters = await adapterManager.getAvailableAdapters();
    return {
      success: true,
      adapters,
      count: adapters.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Get active adapter
 */
ipcMain.handle('get-active-adapter', async (event) => {
  try {
    const adapter = adapterManager.getActiveAdapter();
    return {
      success: true,
      adapter: adapter || { name: 'System Default', isDefault: true },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Select adapter for use
 */
ipcMain.handle('select-adapter', async (event, adapterName) => {
  try {
    const adapter = adapterManager.setActiveAdapter(adapterName);
    return {
      success: true,
      message: `Switched to ${adapter.name}`,
      adapter,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Get adapter details
 */
ipcMain.handle('get-adapter-details', async (event, adapterName) => {
  try {
    const details = await adapterManager.getAdapterDetails(adapterName);
    return {
      success: true,
      details,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Get adapter statistics
 */
ipcMain.handle('get-adapter-stats', async (event, adapterName) => {
  try {
    const stats = await adapterManager.getAdapterStats(adapterName);
    return {
      success: true,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Enable/disable adapter
 */
ipcMain.handle('set-adapter-status', async (event, { adapterName, enabled }) => {
  try {
    const result = await adapterManager.setAdapterStatus(adapterName, enabled);
    return {
      success: result,
      message: `Adapter ${enabled ? 'enabled' : 'disabled'}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Scan with specific adapter
 */
ipcMain.handle('scan-with-adapter', async (event, adapterName) => {
  try {
    const result = await adapterManager.scanWithAdapter(adapterName);
    return {
      success: result.success,
      message: result.success
        ? `Scanning with ${adapterName}`
        : result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Start adapter monitoring
 */
ipcMain.handle('start-adapter-monitoring', async (event, interval = 5000) => {
  try {
    adapterManager.startMonitoring(interval);
    return {
      success: true,
      message: 'Adapter monitoring started',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Stop adapter monitoring
 */
ipcMain.handle('stop-adapter-monitoring', async (event) => {
  try {
    adapterManager.stopMonitoring();
    return {
      success: true,
      message: 'Adapter monitoring stopped',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Periodically send adapter updates to renderer
 */
ipcMain.handle('setup-adapter-updates', async (event) => {
  try {
    // Start monitoring in background
    adapterManager.startMonitoring(3000);

    // Send updates every 3 seconds
    const updateInterval = setInterval(async () => {
      try {
        const adapters = await adapterManager.getAvailableAdapters();
        const activeAdapter = adapterManager.getActiveAdapter();

        event.sender.send('adapter-update', {
          adapters,
          activeAdapter,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error sending adapter update:', error);
      }
    }, 3000);

    // Store interval ID for cleanup
    return {
      success: true,
      message: 'Adapter updates started',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Export adapter configuration
 */
ipcMain.handle('export-adapter-config', async (event) => {
  try {
    const config = adapterManager.exportConfig();

    const result = await dialog.showSaveDialog({
      title: 'Export Adapter Configuration',
      defaultPath: `wifi-sentry-adapters-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!result.canceled) {
      const fs = require('fs').promises;
      await fs.writeFile(result.filePath, JSON.stringify(config, null, 2));
      return {
        success: true,
        message: 'Configuration exported',
        path: result.filePath,
      };
    }

    return {
      success: false,
      message: 'Export cancelled',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

/**
 * Import adapter configuration
 */
ipcMain.handle('import-adapter-config', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Adapter Configuration',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const fs = require('fs').promises;
      const content = await fs.readFile(result.filePaths[0], 'utf-8');
      const config = JSON.parse(content);

      adapterManager.importConfig(config);

      return {
        success: true,
        message: 'Configuration imported',
        config,
      };
    }

    return {
      success: false,
      message: 'Import cancelled',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

module.exports = { adapterManager };
