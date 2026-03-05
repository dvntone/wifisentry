# WiFi Sentry - Configuration & Setup Checklist

**Status**: Ready for Deployment  
**Last Updated**: February 11, 2026

---

## ✅ QUICK VERIFICATION

Run this to verify all fixes are in place:

```bash
# 1. Check for syntax errors
npm run lint

# 2. Check if server starts
npm start

# 3. Test API endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/adapters

# 4. Check adapter routes loaded
# Should see in console:
# ✓ WiFi Adapter Management API loaded
```

---

## 📋 CONFIGURATION CHECKLIST

### 1. Environment Variables (.env)

```bash
# Required
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret-key
MONGODB_URI=mongodb://localhost:27017/wifi-sentry
PORT=3000
ENVIRONMENT=development

# Google Gemini AI (Optional but recommended)
GEMINI_API_KEY=your-gemini-api-key

# 2FA Setup (Optional)
ADMIN_2FA_SECRET=generated-by-app

# Frontend API Configuration  
REACT_APP_API_URL=http://localhost:3000
```

**File**: `.env`

**Actions**:
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all required values
- [ ] Keep sensitive values out of git
- [ ] Use strong passwords

---

### 2. Database Configuration

**MongoDB Setup**:

```bash
# Option 1: Local MongoDB
mongod --version  # Verify installed

# Option 2: MongoDB Atlas (Cloud)
# Visit: mongodb.com/cloud/atlas
# Get connection string and add to .env

# Option 3: Docker MongoDB
docker run -d --name mongodb -p 27017:27017 mongo
```

**Connection Test**:
```bash
# In Node.js console
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('connected', () => console.log('Connected!'));
```

**Status Checklist**:
- [ ] MongoDB running on port 27017
- [ ] Connection string correct in .env
- [ ] Database user credentials if needed
- [ ] Firewall allows 27017

---

### 3. Backend Dependencies

**Install All Dependencies**:
```bash
npm install
```

**Verify Package.json Scripts**:
```bash
# Should show:
npm run start         # Run production server
npm run dev          # Run with nodemon (development)
npm run test         # Run Jest tests
npm run lint         # Fix ESLint issues
npm run web:build    # Build Next.js web app
npm run desktop:build  # Build Electron app
npm run mobile:build   # Build Android app
```

**Status Checklist**:
- [ ] No npm ERR! messages
- [ ] node-wifi@2.0.16+
- [ ] express@4.18.2+
- [ ] mongoose@8.0.0+
- [ ] All other dependencies installed

---

### 4. API Server Startup

**Test Server With All Features**:

```bash
# Development mode with auto-reload
npm run dev
```

**Expected Console Output**:
```
✓ WiFi Adapter Management API loaded
✓ Database connected to MongoDB
WiFi Sentry is running on http://localhost:3000
Environment: development
Location tracking enabled: false
```

**If You See Errors**:

| Error | Fix |
|-------|-----|
| `Cannot find module 'express'` | Run `npm install` |
| `MongooseError: connect ECONNREFUSED` | Start MongoDB, check URI in .env |
| `⚠ WiFi Adapter Management API not available` | Check api/adapters.js exists |
| `Error: listen EADDRINUSE` | Port 3000 in use, change PORT in .env |

**Status Checklist**:
- [ ] Server starts without errors
- [ ] Shows all 4 console messages above
- [ ] Can reach http://localhost:3000 in browser
- [ ] Health endpoint returns features list

---

### 5. Frontend Configuration

**Build Next.js App**:
```bash
cd web-app
npm install
npm run build
cd ..
```

**Environment Variables (Frontend)**:

Create `web-app/.env.local`:
```
REACT_APP_API_URL=http://localhost:3000
# Optional: Add other frontend config here
```

**Test Frontend Access**:
```bash
# After server is running, visit:
http://localhost:3000
```

**Index.tsx**: Should render the WiFi Sentry dashboard

**Status Checklist**:
- [ ] Next.js build succeeds
- [ ] Frontend loads at localhost:3000
- [ ] No 404 errors in browser console
- [ ] API calls go to localhost:3000

---

### 6. Windows WSL2 Setup (For Advanced Features)

**Prerequisites**:
```
- Windows 10/11 Build 19041+
- WSL2 enabled
- Linux distro installed (Ubuntu recommended)
```

**Install Required Tools in WSL**:
```bash
wsl
sudo apt update
sudo apt install -y aircrack-ng tcpdump tshark bettercap

# Verify installation
which airmon-ng  # Should show /usr/bin/airmon-ng
which tcpdump    # Should show /usr/bin/tcpdump
```

**Test WSL2 Integration**:
```bash
# From Windows (PowerShell):
wsl which airmon-ng
wsl sudo tcpdump -h  # May require password
```

**Status Checklist**:
- [ ] WSL2 installed and running
- [ ] Linux distro accessible via `wsl` command
- [ ] aircrack-ng installed: `which airmon-ng` returns path
- [ ] tcpdump installed: `which tcpdump` returns path
- [ ] Can run WSL commands from Node.js

---

### 7. Adapter Management (Electron Desktop)

**Build Electron App**:
```bash
npm run desktop:build
# Creates dist/ folder with installer
```

**Files Created**:
- `dist/WiFi Sentry Setup 1.0.0.exe` - Installer
- `dist/WiFi Sentry 1.0.0.exe` - Portable

**Test Installation**:
- [ ] Run .exe installer
- [ ] Select installation location
- [ ] Create shortcuts
- [ ] Launch app
- [ ] No crash on startup

**Features to Test**:
- [ ] Can start/stop monitoring
- [ ] See live scan results
- [ ] Can select adapter (if Windows)
- [ ] Can enable monitor mode (if WSL2 setup)
- [ ] Can export data

---

### 8. Android Build Setup (Optional)

**Prerequisites**:
```bash
# Install Android SDK tools
npm run mobile:setup

# Verify Android SDK
android --version
adb devices  # Should show connected devices
```

**Build APK**:
```bash
npm run mobile:build

# Find APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

**Deploy to Device**:
```bash
npm run mobile:open     # Opens Android Studio
npm run mobile:run      # Deploys to connected device
```

---

### 9. GitHub Actions Configuration

**Files Created**:
- `.github/workflows/ci-cd.yml` - Test & Build
- `.github/workflows/release.yml` - Releases
- `.github/workflows/dependencies.yml` - Dependency updates

**Secrets to Configure** (GitHub Repo Settings):

1. `GEMINI_API_KEY` - Google Gemini API key (optional)
2. `SIGNING_CERTIFICATE` - Code signing cert (optional)

**Variables to Configure** (GitHub Repo Settings):

```
GOOGLE_CLOUD_PROJECT = your-project
SERVICE_ACCOUNT_EMAIL = your-service-account@project.iam.gserviceaccount.com
```

**Test Workflow**:
```bash
git add .
git commit -m "test: verify workflows"
git push origin main

# Check GitHub Actions tab for running workflows
```

**Status Checklist**:
- [ ] Workflows visible in GitHub Actions tab
- [ ] Test workflow starts on push
- [ ] Web build succeeds
- [ ] Linting passes
- [ ] No dependency vulnerabilities

---

### 10. SSL/HTTPS Configuration

**Development** (localhost):
- No SSL needed
- HTTP only

**Production**:
```bash
# Get SSL cert (Let's Encrypt free option)
certbot certonly --standalone -d your-domain.com

# Update server.js to use HTTPS
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/path/to/privkey.pem'),
  cert: fs.readFileSync('/path/to/cert.pem')
};

https.createServer(options, app).listen(443);
```

**Status Checklist**:
- [ ] Development works on HTTP
- [ ] SSL cert obtained (if deploying)
- [ ] HTTPS endpoint configured
- [ ] Redirect HTTP to HTTPS

---

## 🔍 VERIFICATION TESTS

### API Endpoint Tests

```bash
# Start server first
npm run dev

# In another terminal, run these tests:

# 1. Health check
curl http://localhost:3000/api/health | jq .

# Expected output includes:
# {
#   "status": "healthy",
#   "version": "1.0.0",
#   "features": {...}
# }

# 2. Get adapters
curl http://localhost:3000/api/adapters | jq .

# 3. Get cataloged threats
curl http://localhost:3000/api/cataloged-threats | jq .

# 4. Start monitoring
curl -X POST http://localhost:3000/api/start-monitoring \
  -H "Content-Type: application/json" \
  -d '{"techniques":["karma","evil-twin"]}' | jq .

# 5. Stop monitoring
curl -X POST http://localhost:3000/api/stop-monitoring | jq .

# 6. Export threats as CSV
curl http://localhost:3000/api/export/threats-csv > threats.csv
```

### Frontend Component Tests

```bash
cd web-app

# Run tests
npm test

# Build production
npm run build

# Check build output
ls -la .next/
```

---

## 🚨 TROUBLESHOOTING

### Issue: "Cannot find module 'express'"

**Solution**:
```bash
npm install
npm install --save express@4.18.2
```

### Issue: "Server won't start - Port 3000 in use"

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Issue: "MongoDB connection refused"

**Solution**:
```bash
# Check if MongoDB running
mongod --version

# Start MongoDB if installed locally
mongod

# Or use MongoDB Atlas cloud version
# Update MONGODB_URI in .env
```

### Issue: "Adapter routes not loading"

**Solution**:
```bash
# Check file exists
ls api/adapters.js

# Check server console for error
npm run dev  # Should show ✓ WiFi Adapter Management API loaded
```

### Issue: "SSE events not received in frontend"

**Solution**:
1. Check REACT_APP_API_URL is correct
2. Verify SSE endpoint works:
   ```bash
   curl http://localhost:3000/api/monitoring-stream
   ```
3. Check browser console for CORS errors
4. Verify EventSource connection in DevTools

---

## 📊 Configuration Summary Table

| Component | Status | Location | Dependencies |
|-----------|--------|----------|--------------|
| Backend API | ✅ Ready | server.js | Express, MongoDB |
| Adapter Routes | ✅ Ready | api/adapters.js | Session middleware |
| Frontend App | ✅ Ready | web-app/ | Next.js, React |
| Desktop App | ✅ Ready | desktop/ | Electron, node-wifi |
| Android App | ✅ Ready | android/ | Capacitor, Gradle |
| CI/CD | ✅ Ready | .github/workflows/ | GitHub Actions |
| WSL2 Support | ✅ Ready | desktop/windows-*.js | WSL2, aircrack-ng |
| Database | ⚠️ Manual | .env | MongoDB |

---

## 🎯 DEPLOYMENT STEPS

### Step 1: Prepare Environment
- [ ] `.env` file created with all values
- [ ] MongoDB running and accessible
- [ ] All dependencies installed
- [ ] No lint errors: `npm run lint`

### Step 2: Build All Outputs
```bash
npm run build:all
# Creates:
# - web-app/out/* (web static files)
# - dist/*.exe (Windows installer & portable)
# - android/app/build/outputs/apk/*/*.apk (Android APK)
```

### Step 3: Start Server
```bash
npm start  # Production mode
# or
npm run dev  # Development mode
```

### Step 4: Verify All Systems
- [ ] API health check passes
- [ ] Adapter routes responsive
- [ ] Frontend loads and connects
- [ ] Can start monitoring
- [ ] Can receive SSE updates

### Step 5: Deploy
- [ ] Push to GitHub (triggers CI/CD)
- [ ] All workflows pass
- [ ] Create release tag: `git tag v1.0.1`
- [ ] GitHub Actions creates release artifacts
- [ ] Share release with users

---

## 📞 SUPPORT

**If you encounter issues**:

1. Check [CODE_REVIEW.md](CODE_REVIEW.md) for known issues
2. Check logs: `npm run dev` shows all errors
3. Review [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common tasks
4. Check GitHub Issues for similar problems
5. Review environment variables are correct

---

**All Systems Ready for Deployment** ✅
