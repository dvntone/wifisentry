# WiFi Sentry - Multi-Platform Deployment Guide

## 🎯 Quick Navigation

- [Web App (PWA)](#-web-app-pwa-deployment)
- [Windows Desktop App](#-windows-desktop-app-electron)
- [Android Mobile App](#-android-mobile-app-capacitor)
- [Common Issues](#-troubleshooting)

---

# 🌐 Web App (PWA) Deployment

## Overview
Transform the Next.js web app into a Progressive Web App that works on any device via browser.

### What You Get
✅ Installable to home screen  
✅ Offline functionality  
✅ Push notifications for threats  
✅ Works on desktop, tablet, phone  
✅ No app store approval needed

## Step 1: Update package.json (web-app)

Add PWA-related dependencies:
```bash
cd web-app
npm install next-pwa workbox-window
```

## Step 2: Create PWA Configuration

Create `web-app/next.config.ts`:
```typescript
import withPWA from 'next-pwa';

const nextConfig: any = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default withPWA({
  ...nextConfig,
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,
    sw: '/sw.js',
    runtimeCaching: [
      {
        urlPattern: /^https?.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'offlineCache',
          networkTimeoutSeconds: 20,
        },
      },
    ],
  },
});
```

## Step 3: Create Web App Manifest

Create `web-app/public/manifest.json`:
```json
{
  "name": "WiFi Sentry",
  "short_name": "WiFi Sentry",
  "description": "WiFi threat detection and monitoring",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshot-windows.png",
      "sizes": "540x720",
      "form_factor": "wide",
      "type": "image/png"
    },
    {
      "src": "/screenshot-mobile.png",
      "sizes": "270x540",
      "form_factor": "narrow",
      "type": "image/png"
    }
  ],
  "categories": ["security", "utilities"],
  "shortcuts": [
    {
      "name": "Start Monitoring",
      "short_name": "Monitor",
      "description": "Start WiFi threat monitoring",
      "url": "/dashboard",
      "icons": [
        {
          "src": "/icon-96x96.png",
          "sizes": "96x96",
          "type": "image/png"
        }
      ]
    }
  ]
}
```

## Step 4: Update HTML Head

Update `web-app/src/app/layout.tsx` to include PWA meta tags:
```tsx
export const metadata = {
  title: 'WiFi Sentry',
  description: 'WiFi threat detection and monitoring',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WiFi Sentry',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" href="/icon-192x192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Step 5: Build & Deploy

```bash
# Build Next.js
npm run build

# Test locally
npm start

# Deploy to Vercel (recommended for Next.js)
npm install -g vercel
vercel

# Or deploy to Netlify
netlify deploy --prod --dir=.next
```

## Testing PWA
1. Open app in Chrome/Edge
2. Click install button (address bar or menu)
3. Test offline functionality
4. Check manifest in DevTools

---

# 🖥️ Windows Desktop App (Electron)

## Overview
Package your app as a native Windows desktop application.

### What You Get
✅ .exe installer  
✅ System tray icon  
✅ Auto-updater  
✅ Native Windows integration  
✅ Background monitoring  
✅ Can run backend locally

## Step 1: Install Electron Dependencies

```bash
npm install --save-dev electron electron-builder electron-updater
npm install is-running
```

## Step 2: Create Electron Main Process

Create `desktop/main.js`:
```javascript
const { app, BrowserWindow, Menu, ipcMain, Tray, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');

let mainWindow;
let tray;
let backendProcess;

// Start backend server
function startBackend() {
  if (isDev) {
    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: 'inherit',
    });
  }
}

// Create window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets/icon.ico'),
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../web-app/out/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'assets/icon-tray.png')
  );
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Hide', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
}

// App lifecycle
app.on('ready', () => {
  startBackend();
  createWindow();
  createTray();
  
  // Setup auto-updater
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC handlers
ipcMain.on('get-wifi-status', (event) => {
  // Send WiFi status to frontend
  event.reply('wifi-status-response', { connected: true });
});

module.exports = { mainWindow };
```

Create `desktop/preload.js`:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getWiFiStatus: () => ipcRenderer.invoke('get-wifi-status'),
  onThreatDetected: (callback) =>
    ipcRenderer.on('threat-detected', callback),
});
```

## Step 3: Create Electron Builder Configuration

Update `package.json` with Electron builder config:
```json
{
  "electron-builder": {
    "appId": "com.wifisentry.app",
    "productName": "WiFi Sentry",
    "files": [
      "desktop/main.js",
      "desktop/preload.js",
      "desktop/assets",
      "node_modules",
      "server.js",
      "*.js",
      "web-app/out"
    ],
    "directories": {
      "buildResources": "desktop/assets"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "certificateFile": null,
      "certificatePassword": null
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

## Step 4: Add Build Scripts

Update root `package.json` scripts:
```json
{
  "scripts": {
    "desktop:dev": "electron desktop/main.js",
    "desktop:build-web": "cd web-app && npm run build && cd ..",
    "desktop:build": "npm run desktop:build-web && electron-builder --publish never"
  }
}
```

## Step 5: Build & Package

```bash
# Build for Windows
npm run desktop:build

# Output: dist/WiFi Sentry Setup 1.0.0.exe
```

---

# 📱 Android Mobile App (Capacitor)

## Overview
Deploy the React app as a native Android app using Capacitor bridge.

### What You Get
✅ Native Android app (.apk/.aab)  
✅ Google Play Store compatible  
✅ Direct WiFi API access  
✅ GPS/Location services  
✅ Push notifications  
✅ Offline support

## Step 1: Install Capacitor

```bash
npm install --save-dev @capacitor/core @capacitor/cli
npm install @capacitor/app @capacitor/network @capacitor/geolocation
npx cap init wifi-sentry wifi.sentry

# Install Android platform
npx cap add android
```

## Step 2: Create capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wifisentry.app',
  appName: 'WiFi Sentry',
  webDir: '<br/>web-app/out',
  bundledWebRuntime: false,
  plugins: {
    GoogleAnalytics: {
      analyticsId: 'G-XXXXXXXXXX', // optional
    },
  },
  backgroundColor: '#000000',
};

export default config;
```

## Step 3: Update package.json Scripts

```json
{
  "scripts": {
    "mobile:build": "cd web-app && npm run build && cd .. && npx cap sync",
    "mobile:open": "npx cap open android",
    "mobile:compile": "cd android && ./gradlew assembleRelease && cd ..",
    "mobile:run": "npx cap run android"
  }
}
```

## Step 4: Configure Android Permissions

Edit `android/app/src/main/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <!-- WiFi access permissions -->
  <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
  <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
  
  <!-- Background processing -->
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  
  <!-- Network -->
  <uses-permission android:name="android.permission.INTERNET" />
  
  <application
    android:usesCleartextTraffic="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name">
    
    <activity
      android:name=".MainActivity"
      android:label="@string/app_name"
      android:theme="@style/AppTheme">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

## Step 5: Handle Permissions at Runtime

Create `web-app/src/services/permissions.ts`:
```typescript
import { Permissions } from '@capacitor/core';

export async function requestPermissions() {
  try {
    const result = await Permissions.requestPermissions({
      permissions: [
        'geolocation',
        'camera',
        // WiFi permissions automatically granted on Android 10+
      ],
    });
    return result;
  } catch (error) {
    console.error('Permission request failed:', error);
  }
}
```

## Step 6: Build & Package APK

```bash
# Build for Android
npm run mobile:build

# Output: android/app/build/outputs/bundle/release/app-release.aab
# Or for APK: android/app/build/outputs/apk/release/app-release.apk
```

## Step 7: Upload to Google Play Store

1. Create Google Play Developer account
2. Create app entry
3. Upload signed APK/AAB
4. Fill out app store listing
5. Submit for review

---

# 🔧 Shared API Client

Create `frontend/shared/api-client.ts` for use across all platforms:

```typescript
class APIClient {
  private baseURL: string;
  private sessionToken: string | null = null;

  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async login(username: string, password: string) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    this.sessionToken = data.token;
    return data;
  }

  async startMonitoring() {
    return this.apiCall('/api/start-monitoring', 'POST');
  }

  async stopMonitoring() {
    return this.apiCall('/api/stop-monitoring', 'POST');
  }

  async getCatalogedThreats() {
    return this.apiCall('/api/cataloged-threats', 'GET');
  }

  private async apiCall(endpoint: string, method: string, body?: any) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.sessionToken && { Authorization: `Bearer ${this.sessionToken}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }
}

export default APIClient;
```

---

# 🐛 Troubleshooting

## Web App Issues

### PWA not installing
- Ensure HTTPS is used
- Check manifest.json for errors
- Verify service worker loads

### Offline not working
- Clear service worker cache
- Check cache strategy in next-pwa config

## Windows Desktop Issues

### Backend won't start
- Ensure port 3000 is free
- Check MongoDB is running
- See electron logs: `~/.wifi-sentry/logs/`

### Auto-updater failing
- Sign code with certificate
- Configure update server endpoint

## Android Issues

### WiFi permissions denied
- Check AndroidManifest.xml
- Request permissions at runtime
- Test on Android 10+ (permission model changed)

### App crashes on launch
- Check Logcat: `adb logcat`
- Ensure API level matches
- Test on physical device

---

## 📊 Platform Comparison

| Feature | Web | Windows | Android |
|---------|-----|---------|---------|
| Install Size | 10-50 MB | 100-200 MB | 50-100 MB |
| Startup Time | <2s | 3-5s | 5-10s |
| Memory Usage | 100-200 MB | 300-500 MB | 200-400 MB |
| Distribution | Web host | .exe or MS Store | Google Play |
| Updates | Automatic | Auto-updater | Play Store |
| Offline Capability | Partial | Full | Full |

---

**Deployment Guide Version**: 1.0  
**Last Updated**: February 11, 2026
