/**
 * Port Management IPC Handler Module
 *
 * Exposes port scanning, user port selection, and Windows Defender Firewall
 * management to the renderer process.
 *
 * Register via the HANDLER_MODULES list in main.js — no other file needs editing.
 * New APIs are automatically available in preload.js under window.electron.
 */

'use strict';

const portManager = require('../utils/port-manager');

function register(ipcMain, ctx) {

  /** Check whether a specific port number is currently available. */
  ipcMain.handle('port-check', async (_event, { port }) => {
    const available = await portManager.isPortAvailable(port);
    return { port, available };
  });

  /**
   * Find the first available port starting from preferredPort (or the
   * currently configured backend port).  Returns the found port number.
   */
  ipcMain.handle('port-find-available', async (_event, args) => {
    try {
      const preferred = args?.preferredPort ?? ctx.config.backend.port;
      const port = await portManager.findAvailablePort(preferred);
      return { success: true, port };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /** Return the port the backend is currently running on. */
  ipcMain.handle('port-get-current', () => ({
    port: ctx.config.backend.port,
    url:  `http://localhost:${ctx.config.backend.port}`,
  }));

  /**
   * Change the backend port.
   * - Checks the new port is available.
   * - Persists the choice to settings.json.
   * - Signals that a backend restart is required for the change to take effect.
   * - If the port is in use, suggests the next free port.
   */
  ipcMain.handle('port-set', async (_event, { port }) => {
    const p = parseInt(port, 10);
    if (isNaN(p) || p < 1024 || p > 65535) {
      return { success: false, error: 'Port must be a number between 1024 and 65535.' };
    }

    const available = await portManager.isPortAvailable(p);
    if (!available) {
      let suggested = null;
      try { suggested = await portManager.findAvailablePort(p + 1); } catch { /* ignore */ }
      return { success: false, inUse: true, port: p, suggested,
               error: `Port ${p} is already in use.` };
    }

    // Mutate the live config so get-config / get-backend-port reflect the change.
    ctx.config.backend.port   = p;
    ctx.config.backend.devUrl = `http://localhost:${p}`;

    // Persist to settings.json via existing settings handlers.
    try {
      const fs   = require('fs');
      const path = require('path');
      const settingsDir  = require('electron').app.getPath('appData');
      const settingsPath = path.join(settingsDir, 'WiFi Sentry', 'settings.json');
      const existing = fs.existsSync(settingsPath)
        ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        : {};
      existing.backendPort = p;
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
    } catch (err) {
      ctx.log(`Warning: could not persist port setting: ${err.message}`);
    }

    ctx.log(`Backend port changed to ${p} — restart required`);
    return { success: true, port: p, restartRequired: true };
  });

  // ── Windows Defender Firewall ───────────────────────────────────────────────

  /** Check whether an inbound firewall rule exists for the given (or current) port. */
  ipcMain.handle('firewall-check', async (_event, args) => {
    const port = args?.port ?? ctx.config.backend.port;
    return portManager.checkFirewallRule(port);
  });

  /**
   * Add an inbound Windows Defender Firewall rule for the given (or current) port.
   * Triggers a UAC elevation prompt on Windows.
   * Returns manual instructions if UAC is declined or unavailable.
   */
  ipcMain.handle('firewall-add-rule', async (_event, args) => {
    const port = args?.port ?? ctx.config.backend.port;
    return portManager.addFirewallRule(port);
  });

  /** Remove the WiFi Sentry inbound firewall rule. */
  ipcMain.handle('firewall-remove-rule', async () => {
    return portManager.removeFirewallRule();
  });
}

module.exports = { register };
