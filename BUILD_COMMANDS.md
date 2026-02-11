# Multi-Platform Build & Deployment Commands

## 🎯 Quick Start

### Web App (PWA)
```bash
# Development
npm run web:dev
# Open: http://localhost:3000

# Production build
npm run web:build
```

### Windows Desktop (Electron)
```bash
# Development
npm run desktop:dev

# Production build (creates .exe installer)
npm run desktop:build
```

### Android Mobile (Capacitor)
```bash
# Setup (first time only)
npm run mobile:setup

# Development (sync and run)
npm run mobile:run

# Build APK/AAB
npm run mobile:build
npm run mobile:compile
```

---

## 📋 Complete Command Reference

### Backend
| Command | Purpose |
|---------|---------|
| `npm start` | Start production server |
| `npm run dev` | Start development server (with auto-reload) |

### Frontend - Web
| Command | Purpose |
|---------|---------|
| `npm run web:dev` | Start Next.js development server |
| `npm run web:build` | Build static web app |

### Frontend - Desktop
| Command | Purpose |
|---------|---------|
| `npm run desktop:dev` | Run Electron app in development |
| `npm run desktop:build-web` | Build Next.js for desktop |
| `npm run desktop:build` | Create Windows installer (.exe) |
| `npm run desktop:build-win` | Same as desktop:build |

### Frontend - Mobile
| Command | Purpose |
|---------|---------|
| `npm run mobile:setup` | Install Capacitor (first time) |
| `npm run mobile:sync` | Sync web build to Android |
| `npm run mobile:build` | Build web for mobile |
| `npm run mobile:open` | Open Android Studio |
| `npm run mobile:run` | Deploy to emulator/device |
| `npm run mobile:compile` | Build signed APK/AAB |

### All Platforms
| Command | Purpose |
|---------|---------|
| `npm run build` | Build all platforms (web + desktop + mobile) |
| `npm run test` | Run tests |
| `npm run lint` | Fix linting errors |

---

## 🚀 Deployment Workflows

### Deploy to Web (PWA)
```bash
# 1. Build
npm run web:build

# 2. Deploy to service (Vercel, Netlify, GitHub Pages, etc.)
# Example with Vercel:
npm install -g vercel
vercel
```

### Deploy to Windows
```bash
# 1. Ensure no other instances running

# 2. Build
npm run desktop:build

# 3. Installer created in: dist/WiFi Sentry Setup 1.0.0.exe

# 4. For distribution:
# - Sign the installer (optional but recommended)
# - Host on website or app store
```

### Deploy to Android
```bash
# 1. Setup keystore (first time only)
cd android && ./gradlew signingReport && cd ..

# 2. Build
npm run mobile:build
npm run mobile:compile

# 3. APK/AAB created in: android/app/build/outputs/

# 4. Upload to Google Play Store
```

---

## 📱 Platform Feature Matrix

### WiFi Scanning
- ✅ Web: Browser-based (limited by CORS)
- ✅ Windows: Native via node-wifi
- ✅ Android: Native Android API (requires permissions)

### Real-time Monitoring
- ✅ Web: WebSocket/SSE streaming
- ✅ Windows: Full background monitoring
- ✅ Android: Background service + push notifications

### Location Tracking
- ⚠️ Web: Browser Geolocation API
- ✅ Windows: Native Windows API
- ✅ Android: Native Android Location Services

### Push Notifications
- ✅ Web: Web Push API
- ✅ Windows: Windows Toast Notifications
- ✅ Android: Firebase Cloud Messaging (FCM)

---

## 🔧 Configuration Files

### Shared across all platforms:
- `.env` - Environment variables (backend)
- `config.js` - Backend configuration
- `server.js` - Express.js backend

### Web-specific:
- `web-app/package.json` - Frontend dependencies
- `web-app/next.config.ts` - Next.js configuration
- `web-app/public/manifest.json` - PWA manifest

### Desktop-specific:
- `desktop/main.js` - Electron main process
- `desktop/preload.js` - Electron security context
- `package.json` - electron-builder config

### Mobile-specific:
- `capacitor.config.ts` - Capacitor configuration
- `android/app/AndroidManifest.xml` - Android permissions
- `android/app/build.gradle.kts` - Android build config

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows: Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

### Dependencies Not Installing
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### MongoDB Connection Error
```bash
# Ensure MongoDB is running
mongod

# Or use MongoDB Atlas connection string in .env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/wifi-sentry
```

### Android Build Issues
```bash
# Clear gradle cache
cd android && ./gradlew clean && cd ..

# Rebuild
npm run mobile:build
```

---

## 📊 Build Outputs

### Web App
- Location: `web-app/.next/`
- Upload to: Vercel, Netlify, GitHub Pages, or any static host

### Windows Desktop
- Location: `dist/WiFi Sentry Setup 1.0.0.exe`
- Size: ~150-200 MB
- Distribution: Direct download or Windows Store

### Android App
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Size: ~50-80 MB
- Distribution: Google Play Store

---

## 🔐 Security Checklist

- [ ] All API endpoints require authentication
- [ ] HTTPS enabled for production
- [ ] Environment variables not committed to git
- [ ] Code signing enabled for desktop app
- [ ] App signing configured for Android
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Logging for audit trail
- [ ] Updates signed and verified
- [ ] Permissions explained to users

---

## 📈 Performance Targets

| Metric | Web | Desktop | Mobile |
|--------|-----|---------|--------|
| Startup | <2s | 3-5s | 5-10s |
| Memory | <200MB | 300-500MB | 200-400MB |
| Bundle | 10-50MB | 150-200MB | 50-80MB |

---

**Last Updated**: February 11, 2026
