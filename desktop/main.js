/**
 * Electron Main Process for WiFi Sentry Desktop App
 *
 * Architecture
 * ────────────
 * main.js owns: window, tray, app lifecycle, backend process, auto-updater.
 *
 * All IPC handlers live in separate handler modules under desktop/.
 * Each module exports  register(ipcMain, ctx)  where ctx carries shared
 * references (mainWindow, app, tray, config, services).
 *
 * Adding a new feature (database, map API, Wireshark, cloud backend, …):
 *   1. Create  desktop/handlers/<feature>.js  with register(ipcMain, ctx).
 *   2. Append its path to HANDLER_MODULES below.
 *   3. Enable its feature flag in  desktop/config/desktop.config.js.
 *   Nothing else needs to change.
 */

'use strict';

const { app, BrowserWindow, Menu, ipcMain, Tray, nativeImage, Notification, dialog, shell } =
  require('electron');
const { autoUpdater } = require('electron-updater');
const path  = require('path');
const fs    = require('fs');
const { spawn } = require('child_process');

const cfg = require('./config/desktop.config');
const { findAvailablePort } = require('./utils/port-manager');

// ── Handler modules ──────────────────────────────────────────────────────────
// Each entry is a path (relative to __dirname) to a module that exports
// register(ipcMain, ctx).  Conditionally include modules based on feature flags.
const HANDLER_MODULES = [
  cfg.features.adapterManagement && './adapter-ipc-handlers',
  './handlers/port',                 // port scanning + Windows Firewall — always on
  cfg.features.mapApi              && './handlers/map',             // Leaflet/OSM now, Google Maps ready
  // cfg.features.wireshark       && './handlers/wireshark',   // future
  // cfg.features.database        && './handlers/database',     // future
  // cfg.features.cloudBackend    && './handlers/cloud-backend',// future
].filter(Boolean);

// ── Runtime state ────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' ||
              process.env.ELECTRON_DEV_MODE === 'true';

let mainWindow    = null;
let tray          = null;
let backendProcess = null;
let isMonitoring  = false;

const appDataPath = app.getPath('appData');
const appLogsPath = path.join(appDataPath, 'WiFi Sentry', 'logs');

if (!fs.existsSync(appLogsPath)) {
  fs.mkdirSync(appLogsPath, { recursive: true });
}

// ── Logging ──────────────────────────────────────────────────────────────────
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  const logFile = path.join(appLogsPath, `app-${new Date().toISOString().split('T')[0]}.log`);
  try { fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`); } catch { /* ignore */ }
}

// ── Backend process ──────────────────────────────────────────────────────────
function startBackend() {
  log(`Starting backend server on port ${cfg.backend.port}...`);
  const env = { ...process.env, PORT: String(cfg.backend.port) };
  try {
    if (isDev) {
      backendProcess = spawn('npm', ['run', cfg.backend.devScript], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        detached: false,
      });
    } else {
      backendProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        detached: false,
      });
    }

    backendProcess.stdout.on('data', d => log(`Backend: ${d.toString().trim()}`));
    backendProcess.stderr.on('data', d => log(`Backend Error: ${d.toString().trim()}`));
    backendProcess.on('error', e  => log(`Backend Process Error: ${e.message}`));
    backendProcess.on('close', c  => log(`Backend process exited with code ${c}`));
  } catch (error) {
    log(`Failed to start backend: ${error.message}`);
    dialog.showErrorBox('Backend Error', `Failed to start backend server: ${error.message}`);
  }
}

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  log('Creating main window...');

  mainWindow = new BrowserWindow({
    width:    cfg.window.width,
    height:   cfg.window.height,
    minWidth: cfg.window.minWidth,
    minHeight: cfg.window.minHeight,
    webPreferences: {
      preload:            path.join(__dirname, 'preload.js'),
      nodeIntegration:    false,
      contextIsolation:   true,
      enableRemoteModule: false,
      sandbox:            true,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
  });

  const mainURL = isDev
    ? cfg.backend.devUrl
    : `file://${path.join(__dirname, '..', cfg.backend.prodIndex)}`;

  log(`Loading URL: ${mainURL}`);
  mainWindow.loadURL(mainURL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Main window shown');

    // Auto-start monitoring if the user has opted in
    try {
      const settingsPath = path.join(appDataPath, 'WiFi Sentry', 'settings.json');
      const saved = fs.existsSync(settingsPath)
        ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        : {};
      const shouldAutoStart = saved.autoStartMonitoring ?? cfg.autoLaunch.autoStartMonitoring;
      if (shouldAutoStart) {
        const techniques = saved.defaultTechniques || cfg.autoLaunch.defaultTechniques;
        log(`Auto-starting monitoring with techniques: ${techniques}`);
        mainWindow.webContents.send('auto-start-monitoring', techniques);
      }
    } catch (err) {
      log(`Auto-start check failed: ${err.message}`);
    }
  });

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.on('close', event => {
    if (app.quitting) { mainWindow = null; return; }
    event.preventDefault();
    mainWindow.hide();
  });
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  log('Creating system tray...');

  const iconPath = path.join(__dirname, 'assets', 'icon-tray.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
  }

  tray = new Tray(icon);

  const buildTrayMenu = () => Menu.buildFromTemplate([
    { label: 'Show', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    {
      label: isMonitoring ? 'Stop Monitoring' : 'Start Monitoring',
      click: () => mainWindow?.webContents.send('toggle-monitoring'),
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'WiFi Sentry',
        message: `WiFi Sentry v${app.getVersion()}`,
        detail: 'Advanced WiFi threat detection and monitoring',
      }),
    },
    {
      label: 'Open Logs',
      click: () => shell.openPath(appLogsPath).catch(err => log(`Could not open logs folder: ${err}`)),
    },
    { type: 'separator' },
    { label: 'Exit', click: () => { app.quitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip('WiFi Sentry — WiFi Threat Monitoring');
  tray.on('click', () => mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show());

  // Rebuild tray menu whenever monitoring state changes so the label stays accurate.
  ipcMain.on('set-monitoring', (_event, enabled) => {
    isMonitoring = enabled;
    log(`Monitoring ${enabled ? 'started' : 'stopped'}`);
    tray?.setToolTip(`WiFi Sentry — ${enabled ? 'Monitoring Active' : 'Monitoring Inactive'}`);
    tray?.setContextMenu(buildTrayMenu());
  });
}

// ── App menu ─────────────────────────────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => { app.quitting = true; app.quit(); } },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WiFi Sentry',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About WiFi Sentry',
            message: `WiFi Sentry v${app.getVersion()}`,
            detail: 'Advanced WiFi threat detection and monitoring\n\nDetects: Evil Twins, Karma Attacks, WiFi Pineapples\n\nPowered by Google Gemini AI',
          }),
        },
        {
          label: 'Check for Updates',
          click: () => autoUpdater.checkForUpdates(),
          enabled: cfg.updates.enabled,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── OS Notifications ──────────────────────────────────────────────────────────
/**
 * Show a native OS notification for a detected threat.
 * Respects cfg.notifications.minSeverity so Low/Medium alerts stay quiet.
 */
const SEVERITY_ORDER = { Low: 1, Medium: 2, High: 3, Critical: 4 };

function showThreatNotification(threat) {
  if (!cfg.notifications.enabled) return;
  if (!Notification.isSupported()) return;
  const min = SEVERITY_ORDER[cfg.notifications.minSeverity] ?? SEVERITY_ORDER['High'];
  const sev = SEVERITY_ORDER[threat.severity];
  if (sev === undefined) {
    log(`[notify] Unknown severity "${threat.severity}" — skipping notification`);
    return;
  }
  if (sev < min) return;

  const n = new Notification({
    title: `⚠ WiFi Sentry — ${threat.severity} Threat`,
    body:  `${threat.ssid || 'Unknown SSID'}: ${threat.threat || threat.reason || threat.description || 'Threat detected'}`,
    icon:  path.join(__dirname, 'assets', 'icon.ico'),
    urgency: threat.severity === 'Critical' ? 'critical' : 'normal',
  });
  n.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
  n.show();
}

// Renderer sends threat events received from the backend SSE stream
ipcMain.on('notify-threat', (_event, threat) => showThreatNotification(threat));


function registerCoreHandlers() {
  // Status — uses handle() so invoke() in preload works correctly
  ipcMain.handle('get-status', () => ({
    version:     app.getVersion(),
    platform:    process.platform,
    isMonitoring,
    features:    cfg.features,
  }));

  ipcMain.handle('get-version', () => app.getVersion());

  // Window controls
  ipcMain.handle('minimize-window', () => mainWindow?.minimize());
  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('close-window', () => mainWindow?.close());
  ipcMain.handle('open-dev-tools', () => mainWindow?.webContents.openDevTools());

  // Settings — persisted as JSON in appData
  const settingsPath = path.join(appDataPath, 'WiFi Sentry', 'settings.json');
  ipcMain.handle('get-settings', () => {
    try {
      return fs.existsSync(settingsPath)
        ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        : {};
    } catch { return {}; }
  });
  ipcMain.handle('save-settings', (_event, { settings }) => {
    try {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Auto-launch (open at OS login)
  ipcMain.handle('get-auto-launch', () => {
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('set-auto-launch', (_event, { enabled }) => {
    try {
      app.setLoginItemSettings({ openAtLogin: !!enabled });
      log(`Auto-launch ${enabled ? 'enabled' : 'disabled'}`);
      return { success: true };
    } catch (err) {
      log(`Auto-launch error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  // Auto-start monitoring preference
  ipcMain.handle('get-auto-start-monitoring', () => {
    try {
      const s = fs.existsSync(settingsPath)
        ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        : {};
      return s.autoStartMonitoring ?? cfg.autoLaunch.autoStartMonitoring;
    } catch { return cfg.autoLaunch.autoStartMonitoring; }
  });

  // Logs
  ipcMain.handle('get-logs', async () => {
    try {
      const files = fs.readdirSync(appLogsPath).sort().reverse().slice(0, 5);
      const logs = {};
      for (const file of files) {
        logs[file] = fs.readFileSync(path.join(appLogsPath, file), 'utf-8');
      }
      return logs;
    } catch (err) {
      log(`Error reading logs: ${err.message}`);
      return {};
    }
  });

  ipcMain.handle('export-logs', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `WiFi-Sentry-Logs-${new Date().toISOString().split('T')[0]}.zip`,
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
    });
    if (!result.canceled) log(`Exporting logs to: ${result.filePath}`);
    // TODO: implement ZIP bundling
    return result;
  });

  // Update installation
  ipcMain.on('install-update', () => autoUpdater.quitAndInstall());

  // Config — renderer can read feature flags without direct fs access
  ipcMain.handle('get-config', () => ({
    features:    cfg.features,
    capture:     cfg.capture,
    window:      cfg.window,
  }));
}

// ── Dynamic handler modules ───────────────────────────────────────────────────
function registerHandlerModules() {
  const ctx = {
    mainWindow: () => mainWindow,   // function so handlers always get the current ref
    app,
    tray:       () => tray,
    config:     cfg,
    log,
  };

  for (const modulePath of HANDLER_MODULES) {
    try {
      const mod = require(modulePath);
      if (typeof mod.register === 'function') {
        mod.register(ipcMain, ctx);
        log(`Loaded handler module: ${modulePath}`);
      } else {
        // Legacy modules that self-register on require (adapter-ipc-handlers style)
        log(`Loaded legacy handler module: ${modulePath}`);
      }
    } catch (err) {
      log(`Warning: could not load handler module "${modulePath}": ${err.message}`);
    }
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.on('ready', async () => {
  log('App ready, initialising...');

  if (isDev) app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

  // ── Port resolution ─────────────────────────────────────────────────────────
  // Load persisted port preference from settings.json, then find a free port.
  try {
    const settingsPath = require('path').join(
      app.getPath('appData'), 'WiFi Sentry', 'settings.json'
    );
    if (require('fs').existsSync(settingsPath)) {
      const saved = JSON.parse(require('fs').readFileSync(settingsPath, 'utf-8'));
      if (saved.backendPort) cfg.backend.port = saved.backendPort;
    }
  } catch { /* use default */ }

  try {
    const freePort = await findAvailablePort(cfg.backend.port);
    if (freePort !== cfg.backend.port) {
      log(`Port ${cfg.backend.port} unavailable — using port ${freePort}`);
    }
    cfg.backend.port   = freePort;
    cfg.backend.devUrl = `http://localhost:${freePort}`;
  } catch (err) {
    log(`Port scan failed: ${err.message}`);
    dialog.showErrorBox('Port Error', err.message);
    app.quit();
    return;
  }
  // ───────────────────────────────────────────────────────────────────────────

  startBackend();
  await new Promise(resolve => setTimeout(resolve, cfg.backend.startupDelayMs));

  createWindow();
  createTray();
  createMenu();
  registerCoreHandlers();
  registerHandlerModules();

  if (cfg.updates.enabled && !isDev) {
    log('Checking for updates...');
    autoUpdater.checkForUpdates();
  }

  log('App initialisation complete');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  log('App quitting, cleaning up...');
  app.quitting = true;
  if (backendProcess) { log('Stopping backend process...'); backendProcess.kill(); }
});

// ── Auto-updater events ───────────────────────────────────────────────────────
autoUpdater.on('update-available',  () => { log('Update available'); mainWindow?.webContents.send('update-available'); });
autoUpdater.on('update-downloaded', () => { log('Update downloaded'); mainWindow?.webContents.send('update-downloaded'); });
autoUpdater.on('error', err          => log(`Auto-updater error: ${err.message}`));

// ── Unhandled errors ──────────────────────────────────────────────────────────
process.on('uncaughtException', err => { log(`Uncaught Exception: ${err.message}`); log(err.stack); });

log('Electron main process loaded');

