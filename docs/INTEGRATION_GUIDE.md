# WiFi Adapter Integration Quick Start

This file provides a quick reference for integrating the new WiFi adapter management system into your development workflow.

## What Was Added

### New Files Created

1. **[web-app/src/components/AdapterSettings.tsx](web-app/src/components/AdapterSettings.tsx)** (450 lines)
   - React component for adapter selection and settings
   - Works on Windows, Android, and Web
   - Cross-platform IPC/API integration

2. **[api/adapters.js](api/adapters.js)** (400 lines)
   - Express.js REST API endpoints
   - Platform-aware adapter management
   - Settings persistence, monitoring mode control

3. **[desktop/windows-adapter-manager.js](desktop/windows-adapter-manager.js)** (400 lines)
   - Windows USB WiFi adapter detection via netsh/WMI
   - Real-time monitoring and statistics
   - Configuration import/export

4. **[mobile/android-usb-adapter-manager.ts](mobile/android-usb-adapter-manager.ts)** (500 lines)
   - Android USB OTG adapter management
   - Root access detection
   - Monitor/promiscuous mode support

5. **[desktop/adapter-ipc-handlers.js](desktop/adapter-ipc-handlers.js)** (200 lines)
   - Electron IPC handlers for Windows desktop
   - Bridge between React renderer and native code
   - Real-time adapter updates and configuration

6. **[ADAPTER_MANAGEMENT.md](ADAPTER_MANAGEMENT.md)** (500 lines)
   - Comprehensive system documentation
   - API reference with examples
   - Troubleshooting guide

7. **[web-app/src/components/COMPONENT_README.md](web-app/src/components/COMPONENT_README.md)** (400 lines)
   - Component-specific documentation
   - Props, methods, event handlers
   - Testing and contribution guidelines

### Files Modified

1. **[desktop/preload.js](desktop/preload.js)**
   - Added 30+ adapter-related IPC method exposures
   - Maintained existing functionality

2. **[server.js](server.js)**
   - Added adapter routes registration
   - `const adapterRoutes = require('./api/adapters');`
   - `app.use('/api', adapterRoutes);`

3. **[.env.example](.env.example)**
   - Added adapter management environment variables
   - Documentation for configuration options

## Integration Checklist

### Phase 1: Backend Setup ✅ COMPLETE

- [x] Create [api/adapters.js](api/adapters.js) with REST endpoints
- [x] Register routes in [server.js](server.js)
- [x] Create Windows adapter manager
- [x] Create Android adapter manager

### Phase 2: Desktop (Electron) Setup ⚠️ PARTIALLY COMPLETE

- [x] Create [desktop/adapter-ipc-handlers.js](desktop/adapter-ipc-handlers.js)
- [x] Update [desktop/preload.js](desktop/preload.js) with IPC methods
- [ ] **TODO**: Initialize adapter manager in `desktop/main.js`:
  ```javascript
  const WindowsAdapterManager = require('./windows-adapter-manager');
  const adapterManager = new WindowsAdapterManager();
  require('./adapter-ipc-handlers'); // Ensure handlers are registered
  ```
- [ ] **TODO**: Add adapter settings UI to main Electron window

### Phase 3: Mobile (Android/Capacitor) Setup ⚠️ PARTIALLY COMPLETE

- [x] Create [mobile/android-usb-adapter-manager.ts](mobile/android-usb-adapter-manager.ts)
- [ ] **TODO**: Install Capacitor USB plugin:
  ```bash
  cd web-app
  npm install @capacitor-community/usb
  npx cap sync
  ```
- [ ] **TODO**: Integrate Android manager into React app:
  ```typescript
  import AndroidUSBAdapterManager from '@/managers/android-usb-adapter-manager';
  const adapterManager = new AndroidUSBAdapterManager();
  ```
- [ ] **TODO**: Add native Android permissions to `android/app/src/AndroidManifest.xml`:
  ```xml
  <uses-feature android:name="android.hardware.usb.host" />
  <uses-permission android:name="android.permission.USB_PERMISSION" />
  ```

### Phase 4: React Components ⚠️ PARTIALLY COMPLETE

- [x] Create [web-app/src/components/AdapterSettings.tsx](web-app/src/components/AdapterSettings.tsx)
- [ ] **TODO**: Add to main dashboard (`web-app/src/app/page.tsx`):
  ```tsx
  import AdapterSettings from '@/components/AdapterSettings';
  
  export default function Dashboard() {
    return (
      <div>
        <h1>WiFi Sentry Dashboard</h1>
        <AdapterSettings />
        {/* Other components */}
      </div>
    );
  }
  ```
- [ ] **TODO**: Add CSS imports if needed (component uses Tailwind)

### Phase 5: Configuration ⚠️ PARTIALLY COMPLETE

- [x] Updated [.env.example](.env.example) with adapter settings
- [ ] **TODO**: Copy to `.env` and configure:
  ```bash
  cp .env.example .env
  # Edit .env and set:
  ADAPTER_MANAGEMENT_ENABLED=true
  ADAPTER_AUTO_DETECT_WINDOWS=true
  ADAPTER_MONITOR_INTERVAL=5000
  ANDROID_ADAPTER_ROOT_REQUIRED=true
  ANDROID_ADAPTER_ADVANCED_MODES=true
  ```

### Phase 6: Documentation ✅ COMPLETE

- [x] Create [ADAPTER_MANAGEMENT.md](ADAPTER_MANAGEMENT.md)
- [x] Create [web-app/src/components/COMPONENT_README.md](web-app/src/components/COMPONENT_README.md)

## Testing Checklist

### Windows (Electron)

- [ ] Compile Windows app with `npm run build:windows`
- [ ] Connect USB WiFi adapter
- [ ] Verify adapter appears in adapter list
- [ ] Click adapter → verify it shows as active
- [ ] Check adapter statistics display correctly
- [ ] Export/import adapter config
- [ ] Restart app → verify settings persist

### Android (Capacitor)

- [ ] Build Android app: `npm run build:android`
- [ ] Connect USB WiFi adapter via USB OTG cable
- [ ] Open app → Adapter Settings tab
- [ ] Verify adapter appears in list
- [ ] Select adapter → verify active indicator
- [ ] (Optional) If rooted: enable monitor mode → verify success

### Web (PWA)

- [ ] Start web server: `npm start`
- [ ] Navigate to localhost:3000
- [ ] View adapter settings component
- [ ] Verify adapters display from backend API
- [ ] Change adapter selection
- [ ] Verify settings save to backend

## Running Locally

### Start Backend Server

```bash
# Install dependencies if not already done
npm install

# Start MongoDB (if not already running)
mongod

# Start Express backend
npm start
# Server runs on http://localhost:3000
```

### Start Web/PWA

```bash
cd web-app
npm install
npm run dev
# Web app available at http://localhost:3000 (if not conflicting) or next default port
```

### Start Windows Desktop

```bash
# Terminal 1: Start backend and renderer dev server
npm start

# Terminal 2: Start Electron in dev mode
npm run dev:electron
```

### Start Android

```bash
cd web-app
npm install

# Build Capacitor
npx cap sync

# Open Android Studio
npx cap open android

# Build and run in emulator/device
```

## API Testing

### Test Adapter Endpoints

```bash
# Get available adapters
curl http://localhost:3000/api/adapters?platform=windows

# Get adapter details
curl http://localhost:3000/api/adapters/1

# Select adapter
curl -X POST http://localhost:3000/api/adapters/select \
  -H "Content-Type: application/json" \
  -d '{"adapterId":"adapter-1","platform":"windows"}'

# Get settings
curl http://localhost:3000/api/adapters/settings

# Enable monitor mode (Android)
curl -X POST http://localhost:3000/api/adapters/enable-monitor-mode \
  -H "Content-Type: application/json" \
  -d '{"adapterId":"usb-adapter-1"}'
```

## Troubleshooting Setup

### Backend Not Starting

```
Error: Cannot find module './api/adapters'
Solution: Verify api/adapters.js exists and server.js references it correctly
```

### React Component Not Showing

```
Error: AdapterSettings component not found
Solution: Check import path matches file location
Verify: web-app/src/components/AdapterSettings.tsx exists
```

### IPC Methods Not Available

```
Error: window.electron is undefined
Solution: Verify desktop/preload.js is properly loaded in Electron main.js
Check: BrowserWindow webPreferences has preload path
```

### USB Adapter Not Detected

**Windows**: Check Device Manager for drivers
**Android**: Verify USB OTG cable, check permissions

## Next Steps

1. **Immediate** (This sprint):
   - Integrate AdapterSettings into dashboard
   - Test component on all platforms
   - Debug any API integration issues

2. **Short-term** (Next sprint):
   - Compile and test Windows .exe with real USB adapters
   - Build and test Android APK with USB OTG
   - Complete unit and integration tests

3. **Medium-term** (Future):
   - Add advanced features (packet capture, traffic analysis)
   - Integrate with main threat detection engine
   - Add real-time adapter health monitoring
   - Performance optimization on low-end devices

## Key Directories

```
wifisentry-1/
├── api/
│   └── adapters.js                    ← REST API endpoints
├── desktop/
│   ├── main.js                        ← TODO: Initialize adapter manager
│   ├── preload.js                     ✅ Updated with IPC methods
│   ├── windows-adapter-manager.js     ✅ New
│   └── adapter-ipc-handlers.js        ✅ New
├── mobile/
│   └── android-usb-adapter-manager.ts ✅ New
├── web-app/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx               ← TODO: Add AdapterSettings
│       └── components/
│           ├── AdapterSettings.tsx    ✅ New
│           └── COMPONENT_README.md    ✅ New
├── server.js                          ✅ Updated with adapter routes
├── .env.example                       ✅ Updated with settings
├── ADAPTER_MANAGEMENT.md              ✅ New
└── INTEGRATION_GUIDE.md               ← This file
```

## Documentation Links

- **System Overview**: [ADAPTER_MANAGEMENT.md](ADAPTER_MANAGEMENT.md)
- **Component Guide**: [web-app/src/components/COMPONENT_README.md](web-app/src/components/COMPONENT_README.md)
- **API Reference**: See ADAPTER_MANAGEMENT.md → "API Reference" section
- **Troubleshooting**: See ADAPTER_MANAGEMENT.md → "Troubleshooting" section

## Support & Questions

For detailed documentation on specific components:

- **Windows Adapter Detection**: See `desktop/windows-adapter-manager.js` comments
- **Android USB OTG**: See `mobile/android-usb-adapter-manager.ts` TypeScript interfaces
- **Backend API**: See `api/adapters.js` endpoint definitions
- **React Component**: See `web-app/src/components/COMPONENT_README.md`

---

**Status**: Implementation Complete ✅
**Testing Status**: Not Yet Started ⚠️
**Documentation Status**: Complete ✅
**Next Phase**: Integration & Testing

**Last Updated**: 2024
**Version**: 1.0.0
