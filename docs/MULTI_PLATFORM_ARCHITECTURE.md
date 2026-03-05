# WiFi Sentry - Multi-Platform Deployment Architecture

## 📱 Platform Overview

### Current State
- **Backend**: Node.js + Express (server.js)
- **Frontend**: Next.js + React (web-app/)
- **Web UI**: HTML + vanilla JS (index.html, dashboard.html)
- **Core Logic**: WiFi scanning, threat detection, AI services

### Target Deployments

| Platform | Technology | Status | Use Case |
|----------|-----------|--------|----------|
| **Web App** | Next.js + PWA | ✅ Ready | Browser-based monitoring dashboard |
| **Windows App** | Electron | 🔧 Ready to setup | Desktop application with native Windows integration |
| **Android App** | Capacitor | 🔧 Ready to setup | Mobile monitoring and threat alerts |

---

## 🏗️ Architecture Decision: Shared Backend + Multi-Platform Frontend

### Why This Approach
- **Single source of truth**: One backend API (Express.js)
- **Code reuse**: Shared React components across web and mobile
- **Easy maintenance**: Updates to API benefit all platforms
- **Cost effective**: No duplicate business logic

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│         WiFi Sentry Backend API (Express.js)                 │
│  server.js, database.js, aiService.js, wifi-scanner.js      │
│  MongoDB | Gemini AI | WiFi Detection | Location Tracking    │
└─────────────────────────────────────────────────────────────┘
                          ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  Web App │      │ Windows  │      │ Android  │
   │  PWA     │      │ Electron │      │Capacitor │
   │ Next.js  │      │ Desktop  │      │ Mobile  │
   └──────────┘      └──────────┘      └──────────┘
```

---

## 📋 Platform-Specific Configurations

### 1. Web App (PWA) - Next.js
✅ **Status**: Mostly ready, needs PWA enhancement
- Progressive Web App support
- Service worker for offline mode
- Mobile responsive (already using Tailwind)
- Installable to home screen

**Key Features**:
- Works in browser (desktop/mobile)
- Can work offline with cached data
- Push notifications for threats
- Location sharing (browser API)

### 2. Windows App - Electron
🔧 **Status**: Needs setup
- Desktop application wrapper
- Native Windows integration
- Background monitoring service
- System tray icon
- Auto-updater

**Key Features**:
- Runs backend + frontend bundled
- Native WiFi scanning via `node-wifi`
- System notifications
- Starts on login
- Auto-updates

### 3. Android App - Capacitor
🔧 **Status**: Needs setup  
- Cross-platform app shell
- React Native bridge to Android APIs
- WiFi scanning via Android API
- GPS location with permissions
- Push notifications

**Key Features**:
- Same React code as web app
- Native Android APIs (WiFi, Bluetooth, GPS)
- App Store distribution ready
- Offline sync capability

---

## 🔄 Shared Components Strategy

### Code Organization
```
wifi-sentry/
├── backend/                    # Express.js API (all platforms)
│   ├── server.js
│   ├── api/
│   │   ├── threats.js
│   │   ├── monitoring.js
│   │   ├── locations.js
│   │   └── auth.js
│   └── services/
│       ├── wifi-scanner.js     # Platform-abstracted
│       ├── aiService.js
│       └── database.js
│
├── frontend/
│   ├── web/                    # Next.js web + PWA
│   │   └── web-app/
│   │
│   ├── mobile/                 # Capacitor + React Native
│   │   └── capacitor.config.ts
│   │
│   ├── desktop/                # Electron + React
│   │   └── electron/
│   │
│   └── shared/                 # Reusable components
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types/
│
└── build/
    ├── windows/                # Electron build config
    ├── android/                # Capacitor build config
    └── web/                    # PWA build config
```

---

## 🔧 WiFi Scanning - Cross-Platform Strategy

### Current Implementation (Node.js only)
```javascript
// wifi-scanner.js uses node-wifi
// Works: Windows, macOS, Linux
// Doesn't work: Android, iOS (mobile OS block direct WiFi scanning)
```

### Cross-Platform Solution

#### **For Windows Desktop (Electron)**
- ✅ Use existing `node-wifi` (works directly)

#### **For Android Mobile (Capacitor)**
- 🔄 Use Capacitor WiFi plugin + native Android APIs
- Requires location permission first (system requirement)
- Fallback to location + API-based threat detection

#### **For Web App**
- ⚠️ Limited by browser security
- Options:
  1. Cloud-based threat detection (API call to backend)
  2. User-provided SSIDs
  3. Google Nearby API (limited geolocation)

---

## 📦 Installation & Build Process

### Development Setup (All Platforms)
```bash
# Install dependencies
npm install
cd web-app && npm install

# Set environment variables
cp .env.example .env

# Start backend API
npm run dev

# In another terminal - choose one:
npm run web:dev       # Web/PWA development
npm run desktop:dev   # Electron development
npm run mobile:build  # Capacitor build
```

### Production Builds

#### Web/PWA
```bash
npm run web:build    # Builds Next.js static export
# Deploy to Netlify, Vercel, or any static host
```

#### Windows Desktop
```bash
npm run desktop:build  # Creates .exe installer
# Outputs to dist/wifisentry-Setup-1.0.0.exe
```

#### Android App
```bash
npm run mobile:build   # Builds APK or AAB
# Outputs to android/app/release/
# Upload to Google Play Store
```

---

## 🔐 Platform-Specific Security Considerations

### Web/PWA
- HTTPS required
- CORS properly configured ✅
- Session tokens with expiration
- Content Security Policy (CSP)

### Windows (Electron)
- Code signing for auto-updater
- Sandbox mode enabled
- No eval() or dynamic require
- Protect sensitive APIs with IPC

### Android
- Code obfuscation (ProGuard/R8)
- App signing with keystore
- Permissions declared ✅
- Runtime permission requests
- Network security configuration

---

## 📊 Feature Support by Platform

| Feature | Web | Windows | Android |
|---------|-----|---------|---------|
| WiFi Scanning | ⚠️ Limited | ✅ Full | ✅ Full |
| Threat Detection | ✅ Full | ✅ Full | ✅ Full |
| AI Analysis | ✅ Full | ✅ Full | ✅ Full |
| Location Tracking | ✅ Full | ✅ Full | ✅ Full |
| Offline Mode | ✅ Partial | ✅ Full | ✅ Full |
| Push Notifications | ✅ Web Push | ✅ Windows Toast | ✅ FCM |
| System Tray | ❌ N/A | ✅ Yes | ❌ N/A |
| Background Sync | ⚠️ Service Worker | ✅ Full | ✅ Full |
| Real-time Updates | ✅ WebSocket | ✅ Full | ✅ Push |

---

## 🚀 Deployment Checklist

### Before Release
- [ ] Backend API tested and documented
- [ ] All API endpoints working
- [ ] Environment variables configured
- [ ] Database migrations complete
- [ ] API rate limiting configured
- [ ] Logging and monitoring setup

### Web/PWA Release
- [ ] PWA manifest configured
- [ ] Service worker tested
- [ ] SSL certificate installed
- [ ] CORS headers verified
- [ ] Performance optimized
- [ ] Hosted on CDN

### Windows Release
- [ ] Code signed
- [ ] Installer tested on Windows 10/11
- [ ] Auto-updater configured
- [ ] Crash reporting enabled
- [ ] System requirements documented

### Android Release  
- [ ] App signed with keystore
- [ ] Tested on Android 8+
- [ ] Permissions justified to users
- [ ] Privacy policy provided
- [ ] Terms of service available

---

## 📚 Next Steps

1. **Web App (PWA)** - Add manifest, service worker, offline support
2. **Windows (Electron)** - Add Electron main process, webpack config
3. **Android (Capacitor)** - Add Capacitor config, Android plugins
4. **Shared Services** - Create API client abstraction layer
5. **Build Scripts** - Add platform-specific npm scripts
6. **Testing** - Setup testing for each platform

See: `DEPLOYMENT_GUIDE.md` for step-by-step instructions for each platform.

---

**Architecture Version**: 1.0  
**Last Updated**: February 11, 2026
