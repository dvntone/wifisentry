/**
 * Electron Main Process for WiFi Sentry Desktop App
 * Handles window management, IPC, and backend process lifecycle
 */

const { app, BrowserWindow, Menu, ipcMain, Tray, nativeImage, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = typeof process.env.ELECTRON_DEV_MODE !== 'undefined';
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let tray;
let backendProcess;
let isMonitoring = false;

const appDataPath = app.getPath('appData');
const appLogsPath = path.join(appDataPath, 'WiFi Sentry', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(appLogsPath)) {
  fs.mkdirSync(appLogsPath, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  
  const logFile = path.join(appLogsPath, `app-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Start backend server
function startBackend() {
  log('Starting backend server...');
  
  try {
    if (isDev) {
      // Development: run npm script
      backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });
    } else {
      // Production: run server.js directly
      backendProcess = spawn(process.execPath, [path.join(__dirname, '../server.js')], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });
    }

    backendProcess.stdout.on('data', (data) => {
      log(`Backend: ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      log(`Backend Error: ${data.toString().trim()}`);
    });

    backendProcess.on('error', (error) => {
      log(`Backend Process Error: ${error.message}`);
    });

    backendProcess.on('close', (code) => {
      log(`Backend process exited with code ${code}`);
    });
  } catch (error) {
    log(`Failed to start backend: ${error.message}`);
    dialog.showErrorBox('Backend Error', `Failed to start backend server: ${error.message}`);
  }
}

// Create main window
function createWindow() {
  log('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '../desktop/assets/icon.ico'),
    show: false, // Don't show until ready
  });

  // Load URL
  const mainURL = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../web-app/.next/standalone/public/index.html')}`;

  log(`Loading URL: ${mainURL}`);
  mainWindow.loadURL(mainURL);

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Main window shown');
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (app.quitting) {
      mainWindow = null;
    } else {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Create system tray icon
function createTray() {
  log('Creating system tray...');

  const iconPath = isDev
    ? path.join(__dirname, '../desktop/assets/icon-tray.png')
    : path.join(app.getAppPath(), 'desktop/assets/icon-tray.png');

  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // Fallback if icon not found
    icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: isMonitoring ? 'Stop Monitoring' : 'Start Monitoring',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-monitoring');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'WiFi Sentry',
          message: 'WiFi Sentry v1.0.0',
          detail: 'Advanced WiFi threat detection and monitoring',
        });
      },
    },
    {
      label: 'Open Logs',
      click: () => {
        require('child_process').exec(`start "" "${appLogsPath}"`);
      },
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.quitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('WiFi Sentry - WiFi Threat Monitoring');

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WiFi Sentry',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About WiFi Sentry',
              message: 'WiFi Sentry v1.0.0',
              detail: 'Advanced WiFi threat detection and monitoring\n\nDetects: Evil Twins, Karma Attacks, WiFi Pineapples\n\nPowered by Google Gemini AI',
            });
          },
        },
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdates();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC Handlers
ipcMain.on('get-status', (event) => {
  event.reply('status-response', {
    version: app.getVersion(),
    platform: process.platform,
    isMonitoring,
  });
});

ipcMain.on('set-monitoring', (event, enabled) => {
  isMonitoring = enabled;
  log(`Monitoring ${enabled ? 'started' : 'stopped'}`);
  if (tray) {
    tray.setToolTip(`WiFi Sentry - ${enabled ? 'Monitoring Active' : 'Monitoring Inactive'}`);
  }
});

ipcMain.handle('get-logs', async () => {
  try {
    const files = fs.readdirSync(appLogsPath).sort().reverse().slice(0, 5);
    const logs = {};
    
    for (const file of files) {
      const filePath = path.join(appLogsPath, file);
      logs[file] = fs.readFileSync(filePath, 'utf-8');
    }
    
    return logs;
  } catch (error) {
    log(`Error reading logs: ${error.message}`);
    return {};
  }
});

ipcMain.handle('export-logs', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `WiFi-Sentry-Logs-${new Date().toISOString().split('T')[0]}.zip`,
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
  });

  if (!result.canceled) {
    log(`Exporting logs to: ${result.filePath}`);
    // TODO: Implement ZIP export logic
  }

  return result;
});

// App lifecycle
app.on('ready', async () => {
  log('App ready, initializing...');
  
  // Allow localhost for development
  if (isDev) {
    app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
  }

  startBackend();
  
  // Wait for backend to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  createWindow();
  createTray();
  createMenu();

  // Check for updates (production only)
  if (!isDev) {
    log('Checking for updates...');
    autoUpdater.checkForUpdates();
  }

  log('App initialization complete');
});

app.on('window-all-closed', () => {
  // On macOS, keep app active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  log('App quitting, cleaning up...');
  app.quitting = true;
  
  if (backendProcess) {
    log('Stopping backend process...');
    backendProcess.kill();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`);
  log(error.stack);
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  log('Update available');
  mainWindow?.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  log('Update downloaded, will install on quit');
  mainWindow?.webContents.send('update-downloaded');
});

autoUpdater.on('error', (error) => {
  log(`Auto-updater error: ${error.message}`);
});

log('Electron main process loaded');
