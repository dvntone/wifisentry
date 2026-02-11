# WiFi Sentry - Comprehensive Structural & User Experience Audit

**Date**: February 11, 2026  
**Status**: ⚠️ CRITICAL ISSUES FOUND - Needs Restructuring

---

## 📊 AUDIT SUMMARY

| Category | Issues Found | Severity | Status |
|----------|--------------|----------|--------|
| **File Structure** | 8 major | 🔴 Critical | Needs cleanup |
| **Naming Conventions** | 5 issues | 🟡 Medium | Needs standardization |
| **Obsolete Items** | 10+ files | 🔴 Critical | Should be deleted |
| **API Access** | 4 issues | 🔴 Critical | Hardcoded URLs |
| **Permissions/Auth** | 3 issues | 🟡 Medium | Security risk |
| **User Setup** | 7 pain points | 🔴 Critical | Too complex |
| **Documentation** | 4 issues | 🟡 Medium | Scattered & confusing |

**Overall**: ⚠️ **MODERATE TO HIGH RISK** - Structure undermines ease of use

---

## 🗂️ FILE STRUCTURE ISSUES

### 1. 🔴 CRITICAL: Obsolete Old Frontend Files

**Problem**: Old HTML/CSS/JS files from original implementation exist in root:
```
Root directory (SHOULD NOT BE HERE):
├── index.html          ❌ OLD - Replaced by Next.js
├── login.html          ❌ OLD - Replaced by Next.js
├── dashboard.html      ❌ OLD - Replaced by Next.js
├── 2fa-verify.html     ❌ OLD - Replaced by Next.js
├── app.js              ❌ OLD - Frontend logic
├── login.js            ❌ OLD - Frontend logic
├── dashboard.js        ❌ OLD - Frontend logic
├── 2fa-verify.js       ❌ OLD - Frontend logic
└── styles.css          ❌ OLD - Replaced by Tailwind
```

**Impact**:
- Confuses users on which UI is the "real" one
- Dead code clogs the repository
- server.js tries to serve these from non-existent "public/" dir
- Wastes time for new developers

**Impact**:
```javascript
// server.js (Lines 49-65) - Tries to serve from wrong location
app.use(express.static(path.join(__dirname, 'public')));  // ❌ Doesn't exist!
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));  // ❌ 404
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));  // ❌ 404
});
```

**Solution**: DELETE all old files:
```bash
rm -f index.html login.html dashboard.html 2fa-verify.html
rm -f app.js login.js dashboard.js 2fa-verify.js
rm -f styles.css
```

---

### 2. 🔴 CRITICAL: Missing "public" Directory

**Problem**: server.js serves static files from `public/` directory that doesn't exist

**Current Structure**:
```
WiFi Sentry/
├── public/        ❌ DOESN'T EXIST
├── web-app/
│   └── .next/     ✅ Built app here
└── server.js      (tries to use /public/)
```

**Solution**:
- Option A: Delete the old `/public` reference in server.js
- Option B: Create proper `public/` folder and move assets
- **RECOMMENDED**: Use Next.js static file handling directly

---

### 3. 🟡 MAJOR: Documentation Scattered in Root

**Problem**: 15+ markdown files in root directory:
```
Root (TOO MANY DOCS):
├── README.md
├── INSTALLATION.md
├── QUICK_START.md
├── SETUP_CHECKLIST.md
├── WINDOWS_WSL2_MONITORING.md
├── GITHUB_ACTIONS_CI_CD.md
├── IMPLEMENTATION_SUMMARY.md
├── DEPLOYMENT_GUIDE.md
├── STATUS_REPORT.md
├── READY_FOR_DEPLOYMENT.md
├── ADAPTER_MANAGEMENT.md
├── COMPONENT_README.md (nested)
├── BUILD_COMMANDS.md
├── PROJECT_REVIEW.md
├── CODE_REVIEW.md
├── FIX_VERIFICATION.md
├── CHANGES.md
├── INDEX.md
├── QUICK_REFERENCE.md
└── INTEGRATION_GUIDE.md
```

**Impact**:
- Cluttered root directory
- Users don't know which doc to read first
- Hard to maintain
- Looks unprofessional

**Solution**: Create `docs/` structure:
```
docs/
├── README.md                    (overview)
├── GETTING_STARTED.md          (3-step setup)
├── SETUP/
│   ├── windows-wsl2.md
│   ├── android.md
│   ├── web.md
│   └── dev-setup.md
├── DEPLOYMENT/
│   ├── production.md
│   ├── github-actions.md
│   └── docker.md
├── API/
│   ├── rest-api.md
│   └── websocket.md
├── COMPONENTS/
│   ├── adapter-settings.md
│   └── live-scan-results.md
└── TROUBLESHOOTING.md
```

**Recommendation**: Keep only 2 files in root:
- `README.md` - Quick overview + link to docs/
- `QUICK_START.md` - 3-minute setup guide

---

### 4. 🟡 MAJOR: Unclear Folder Purpose

**Problem**: `frontend-shared/` folder exists but unclear purpose
```
frontend-shared/  ❓ What is this?
```

**Solution**: 
- Document its purpose OR delete it
- If it contains shared React components, move to `web-app/src/shared/`

---

### 5. 🟡 DEBUG ARTIFACTS IN ROOT

**Problem**: Debug log files in root:
```
Root:
├── dataconnect-debug.log    ❌ Debug artifact
└── pglite-debug.log         ❌ Debug artifact
```

**Solution**: Add to `.gitignore`:
```gitignore
*-debug.log
.DS_Store
Thumbs.db
```

---

### 6. 🟡 Firebase Configuration Unused?

**Problem**: Firebase files present but possibly unused:
```
├── .firebase/
├── .firebaserc
├── firebase.json
├── dataconnect/
```

**Solution**: 
- Clarify: Is Firebase being used?
  - YES: Document initialization steps
  - NO: Remove these files and Firebase from package.json

---

## 🏷️ NAMING CONVENTION ISSUES

### 1. 🟡 Inconsistent File Naming

**Problem**: Mix of naming styles:
```
Backend services:
├── wifi-scanner.js              (kebab-case) ✓
├── location-tracker.js          (kebab-case) ✓
├── evil-twin-detector.js        (kebab-case) ✓
├── karma-attack.js              (kebab-case) ✓
├── adapter-ipc-handlers.js      (kebab-case) ✓
└── windows-wsl2-adapter-manager.js (kebab-case) ✓

But also:
├── aiService.js                 (camelCase) ❌
├── config.js                    (lowercase) ✓
├── server.js                    (lowercase) ✓
└── database.js                  (lowercase) ✓
```

**Impact**: Inconsistent codebase appearance makes it look unprofessional

**Solution**: Standardize on lowercase or kebab-case for Node.js files:
```bash
# Rename:
mv aiService.js ai-service.js

# Update imports everywhere
```

---

### 2. 🟡 Next.js Component Naming - PascalCase (Good!)

**Components** (Correctly named):
```
web-app/src/components/
├── LiveScanResults.tsx      ✓ PascalCase
├── AdapterSettings.tsx      ✓ PascalCase
└── COMPONENT_README.md      (should be lowercase)
```

**Status**: ✅ Good - Following React conventions

---

### 3. 🟡 Desktop Files Location

**Problem**: Desktop app files scattered:
```
desktop/
├── main.js
├── preload.js
├── windows-adapter-manager.js
├── windows-wsl2-adapter-manager.js
└── adapter-ipc-handlers.js

But adapter-ipc-handlers.js should be:
desktop/ipc/handlers/ or desktop/handlers/
```

**Solution**: Organize by feature:
```
desktop/
├── main.js
├── preload.js
├── managers/
│   ├── windows-adapter-manager.js
│   └── windows-wsl2-adapter-manager.js
└── ipc/
    └── handlers.js
```

---

### 4. 🟡 Environment/Config Naming

**Multiple naming patterns**:
```
.env                    ✓ Standard
.env.example            ✓ Standard
.vscode/                ✓ Standard
.github/                ✓ Standard
.firebase/              ❓ Should be .firebaserc
.firebaserc             ⚠️ Redundant with firebase.json
firebase.json           ⚠️ Redundant with .firebaserc
capacitor.config.ts     ✓ Standard
```

**Solution**: Clean up Firebase config - use ONE standard:
```bash
# Keep one:
.firebaserc  (simpler)

# Or remove if Firebase not used
```

---

### 5. 🟡 API Routes Naming

**Current**: `api/adapters.js` ✓ Good - describes resource

**Potential future**: Ensure consistency:
```
api/
├── adapters.js           (resource name) ✓
├── threats.js            (if it existed)
└── locations.js          (if it existed)
```

**Status**: ✅ Good pattern - continue with RESTful naming

---

## 🚫 OBSOLETE ITEMS TO DELETE

### Priority 1 - DELETE IMMEDIATELY:
```
1. index.html           (old UI)
2. login.html           (old UI)
3. dashboard.html       (old UI)
4. 2fa-verify.html      (old UI)
5. app.js               (old logic)
6. login.js             (old logic)
7. dashboard.js         (old logic)
8. 2fa-verify.js        (old logic)
9. styles.css           (old CSS - Tailwind is used now)
```

**Action**:
```bash
rm -f index.html login.html dashboard.html 2fa-verify.html
rm -f app.js login.js dashboard.js 2fa-verify.js
rm -f styles.css

git commit -m "chore: remove obsolete old UI files - using Next.js frontend"
```

---

### Priority 2 - CLARIFY THEN DELETE:
```
10. frontend-shared/    (unclear purpose)
11. .firebase/          (if Firebase not used)
12. .firebaserc         (if Firebase not used)
13. firebase.json       (if Firebase not used)
14. dataconnect/        (if Firebase not used)
```

---

### Priority 3 - REMOVE DEBUG ARTIFACTS:
```
15. dataconnect-debug.log
16. pglite-debug.log
17. All .log files
```

**Add to .gitignore**:
```gitignore
*.log
*-debug.log
.DS_Store
Thumbs.db
.env
```

---

## 🔗 API ACCESS ISSUES

### 1. 🔴 CRITICAL: Hardcoded API URLs

**Problem**: API URLs hardcoded to localhost:3000 in frontend:

**File: web-app/src/app/page.tsx (Line 14)**:
```typescript
const API_BASE = 'http://localhost:3000/api';  // ❌ Hardcoded!
```

**File: web-app/src/components/LiveScanResults.tsx (Lines 37, 70, 84)**:
```typescript
eventSource = new EventSource('http://localhost:3000/api/monitoring-stream');
fetch('http://localhost:3000/api/start-monitoring', ...)
fetch('http://localhost:3000/api/stop-monitoring', ...)
```

**Impact**:
- Won't work in production (different domain)
- Won't work with different backend URLs
- Breaks Docker/containerized deployments
- Breaks custom installations

**Solution**: Use environment variables

```typescript
// ✅ FIXED: web-app/src/app/page.tsx
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ✅ FIXED: web-app/src/components/LiveScanResults.tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
eventSource = new EventSource(`${API_URL}/api/monitoring-stream`);
```

**Create .env.local**:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**For production**: Update on deploy
```
NEXT_PUBLIC_API_URL=https://api.wifisentry.com
```

---

### 2. 🟡 MAJOR: No API Documentation Structure

**Problem**: No clear endpoint documentation

**Solution**: Create `docs/API.md`:
```markdown
# WiFi Sentry API Documentation

## Authentication
- POST /api/auth/login
- POST /api/auth/2fa/verify
- POST /api/auth/logout

## Monitoring
- POST /api/start-monitoring
- POST /api/stop-monitoring
- GET /api/monitoring-stream (SSE)

## Adapters
- GET /api/adapters
- GET /api/adapters/:id
...
```

---

### 3. 🟡 CSRF Protection Missing

**Problem**: No CSRF tokens for state-changing requests

**API Calls**:
```typescript
// ❌ No CSRF protection
fetch('http://localhost:3000/api/start-monitoring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ techniques })
});
```

**Solution**: Add CSRF middleware in Express

---

### 4. 🟡 No API Versioning

**Problem**: API not versioned for future compatibility

**Solution**: Plan for `/api/v1/` routes:
```
GET /api/v1/adapters
GET /api/v1/threats
GET /api/v1/health
```

---

## 🔐 PERMISSIONS & AUTHENTICATION ISSUES

### 1. 🔴 CRITICAL: Default Credentials in Code

**Problem**: config.js has default passwords

**File: config.js (Lines 11-13)**:
```javascript
auth: {
    sessionSecret: process.env.SESSION_SECRET || 'super-secret-key-for-dev',  // ⚠️ Weak
    adminUsername: process.env.ADMIN_USERNAME || 'admin',                    // ⚠️ Default
    adminPassword: process.env.ADMIN_PASSWORD || 'password',                 // ⚠️ INSECURE!
}
```

**Impact**:
- Anyone with source code can login
- Breaks security in production
- SQL injection vector

**Solution**: Require environment variables for production

```javascript
// ✅ FIXED: config.js
if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
        throw new Error('SESSION_SECRET and ADMIN_PASSWORD required in production');
    }
}

auth: {
    sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || (() => {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ADMIN_PASSWORD not set');
        }
        return 'dev-password';
    })(),
}
```

**Update .env.example**:
```bash
# REQUIRED in production
SESSION_SECRET=your-very-secure-random-key-here
ADMIN_PASSWORD=your-very-secure-password-here

# Optional
ADMIN_USERNAME=admin
ADMIN_2FA_SECRET=your-2fa-secret
```

---

### 2. 🟡 MAJOR: 2FA Optional by Default

**Problem**: 2FA not enforced or encouraged

**Impact**: User accounts less secure

**Solution**: Make 2FA required:
```javascript
// ✅ RECOMMENDED: server.js
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === config.auth.adminUsername && 
        password === config.auth.adminPassword) {
        
        // ALWAYS require 2FA (no bypass)
        if (!config.auth.adminTwoFactorSecret) {
            return res.status(500).json({
                error: 'Server missing 2FA setup. Admin must run initial setup.',
                requiresSetup: true
            });
        }
        
        req.session.awaiting2fa = true;
        res.json({ success: true, twoFactorRequired: true });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid username or password.' 
        });
    }
});
```

---

### 3. 🟡 MAJOR: No Role-Based Access Control

**Problem**: All authenticated users get equal access

**Current**: `isAuthenticated` middleware ✓
**Missing**: Role-based checks (admin, user, analyst)

**Solution**: Add role checking

```javascript
const hasRole = (role) => (req, res, next) => {
    if (req.session.user?.role === role) {
        return next();
    }
    res.status(403).json({ error: 'Forbidden' });
};

// Usage:
app.post('/api/admin/users', hasRole('admin'), (req, res) => {
    // Only admins can access
});
```

---

## 👤 USER SETUP COMPLEXITY

### 1. 🔴 CRITICAL: Multiple Documentation Files

**Problem**: Users confused about setup process

**Current Docs**:
- README.md (overview)
- QUICK_START.md (setup?)
- INSTALLATION.md (setup?)
- SETUP_CHECKLIST.md (checklist?)
- DEPLOYMENT_GUIDE.md (deployment?)

**User's Mental Model**: "Which one do I read?"

**Solution**: Create ONE clear getting-started flow

```
For complete onboarding, follow these in order:
1. README.md (what is this?)
2. docs/GETTING_STARTED.md (quick setup - 5 min)
3. docs/SETUP/ folder (platform-specific)
4. Run app
5. docs/TROUBLESHOOTING.md (if issues)
```

---

### 2. 🔴 CRITICAL: Multiple Installation Steps

**Problem**: Setup requires many separate commands

**Current process**:
```bash
# Step 1: Install backend deps
npm install

# Step 2: Install frontend deps
cd web-app && npm install && cd ..

# Step 3: Configure env
cp .env.example .env
# ... edit .env manually

# Step 4: Start backend
npm start
# In another terminal:

# Step 5: Start frontend
cd web-app && npm run dev
# 5 separate commands for a 10-minute setup!
```

**User Pain**: "Why is this so complicated? I thought this was an app?"

**Solution**: Create setup script

```bash
# ✅ FIXED: One command to rule them all
npm run setup

# Or for Windows
npm run setup:windows
```

**File: setup.js**
```javascript
#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 WiFi Sentry Setup\n');

// Step 1: Check Node version
console.log('✓ Node.js check...');

// Step 2: Install root dependencies
console.log('✓ Installing backend dependencies...');
exec('npm install');

// Step 3: Install frontend dependencies  
console.log('✓ Installing frontend dependencies...');
exec('cd web-app && npm install');

// Step 4: Create .env if missing
if (!fs.existsSync('.env')) {
    console.log('✓ Creating .env file...');
    fs.copyFileSync('.env.example', '.env');
    console.log('⚠️  EDIT .env with your API keys');
}

console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('1. Edit .env file with your credentials');
console.log('2. Run: npm run dev:all');
console.log('3. Open: http://localhost:3000\n');
```

**Add to package.json**:
```json
{
  "scripts": {
    "setup": "node scripts/setup.js",
    "dev:all": "concurrently \"npm start\" \"npm run web:dev\"",
    "dev:all:win": "concurrently \"npm start\" \"cd web-app && npm run dev\""
  }
}
```

---

### 3. 🔴 No Single Entry Point

**Problem**: Users don't know how to start the app

**Current Confusion**:
- Is it the old HTML files? NO
- Is it Next.js? YES but HOW?
- Is it backend only? NO, need frontend too
- Do I run both simultaneously? YES but HOW?

**Solution**: Add clear startup instructions

**File: docs/GETTING_STARTED.md**:
```markdown
# Getting Started - 5 Minutes

## For Development

### Option 1: Simple (Recommended)
```bash
npm run setup      # One-time setup
npm run dev:all    # Start everything
# Opens at http://localhost:3000
```

### Option 2: Advanced (Separate terminals)
```bash
# Terminal 1: Backend
npm start

# Terminal 2: Frontend  
cd web-app && npm run dev
```

## For Production

### Docker (Recommended)
```bash
docker-compose up
# Opens at your-domain.com
```

### Manual
```bash
npm run build:all
npm start
```
```

---

### 4. 🟡 MAJOR: Environment Variables Not Clear

**Problem**: .env.example has too many fields

**Current .env.example**:
- 20+ fields
- No indication of which are required: vs optional
- No explanation of what each does
- Doesn't mention where to get API keys

**Solution**: Rewrite .env.example with comments

```bash
# ===== REQUIRED =====
# The app WILL NOT START without these

# Backend port (leave as 3000 unless you have a conflict)
PORT=3000

# Admin credentials for dashboard login
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-to-something-secure

# Session encryption key (run: openssl rand -hex 32)
SESSION_SECRET=your-random-session-secret-here

# Database connection - MongoDB
# Local: mongodb://localhost:27017/wifi-sentry
# Cloud: mongodb+srv://user:pass@cluster.mongodb.net/wifi-sentry
MONGO_URI=mongodb://localhost:27017/wifi-sentry

# ===== OPTIONAL (but recommended) =====
# The app works without these, but features are limited

# Google Gemini API for AI threat analysis
# Get it from: https://makersuite.google.com
GOOGLE_GEMINI_API_KEY=your-api-key-here

# Google Maps for location display
# Get it from: https://console.cloud.google.com
GOOGLE_MAPS_API_KEY=your-api-key-here

# ===== OPTIONAL (advanced) =====

# 2FA Secret (leave empty to disable 2FA)
# Run: npm run setup:2fa
ADMIN_2FA_SECRET=

# WiGLE.net API credentials for wardriving export
WIGLE_API_NAME=
WIGLE_API_TOKEN=

# Development/Debugging
DEBUG=false
LOG_LEVEL=info
NODE_ENV=development
```

---

### 5. 🟡 MAJOR: No Development vs Production Distinction

**Problem**: Unclear setup path for different environments

**Solution**: Create separate setup guides

```
docs/SETUP/
├── development.md      (localhost, no SSL, debug on)
├── production.md       (real domain, SSL required, debug off)
├── docker.md          (containerized)
└── raspberry-pi.md    (IoT device)
```

---

### 6. 🟡 No Docker Support

**Problem**: Users install locally - different OS issues

**Solution**: Create docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  wifi-sentry:
    build: .
    ports:
      - "3000:3000"
    environment:
      MONGO_URI: mongodb://mongodb:27017/wifi-sentry
      PORT: 3000
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    depends_on:
      - mongodb

volumes:
  mongo-data:
```

**Add to .gitignore**:
```
.env
node_modules/
dist/
.next/
```

---

### 7. 🟡 No .nvmrc for Node Version

**Problem**: Works on Node 18 but might break on Node 16 or 20

**Solution**: Add .nvmrc

```
18.20.0
```

**Add to README**:
```bash
# If you use nvm:
nvm use

# If you use fnm:
fnm use
```

---

## 📊 SUMMARY OF CRITICAL FIXES NEEDED

### IMMEDIATE (Do Today):
- [ ] Delete 9 obsolete old UI files
- [ ] Fix hardcoded `localhost:3000` URLs → use env vars
- [ ] Update package.json metadata
- [ ] Update Next.js layout.tsx metadata
- [ ] Add environment variable requirement checks
- [ ] Create .nvmrc

### WEEK 1 (Do This Week):
- [ ] Reorganize docs into `docs/` folder
- [ ] Create setup script (`setup.js`)
- [ ] Add `dev:all` npm script
- [ ] Create getting started guide
- [ ] Clean up Firebase config (delete if unused)
- [ ] Standardize file naming (aiService.js → ai-service.js)

### WEEK 2 (Next Sprint):
- [ ] Add Docker support
- [ ] Add 2FA requirement
- [ ] Improve .env.example with comments
- [ ] Create role-based access control
- [ ] Add CSRF protection
- [ ] Setup API versioning

---

## ✅ EASE OF USE IMPROVEMENTS

### Before vs After

**CURRENT USER EXPERIENCE** ❌:
```
Is this Node.js or HTML?
├─ public directory doesn't exist (broken)
├─ Multiple documentation files (confusing)
├─ Old HTML files mixed with new React (confusing)
├─ 5 separate commands to start (annoying)
└─ Hardcoded localhost:3000 (won't scale)
```

**IMPROVED USER EXPERIENCE** ✅:
```
One clear, modern app
├─ Old files removed (clean)
├─ One getting started guide (clear)
├─ Only Next.js UI (modern)
├─ One command to start: `npm run dev` (easy)
└─ Configurable API URL (scalable)
```

---

## 📋 CHECKLIST FOR RESTRUCTURING

**Priority 1 - Delete Obsolete Files**:
- [ ] Delete index.html
- [ ] Delete login.html  
- [ ] Delete dashboard.html
- [ ] Delete 2fa-verify.html
- [ ] Delete app.js
- [ ] Delete login.js
- [ ] Delete dashboard.js
- [ ] Delete 2fa-verify.js
- [ ] Delete styles.css
- [ ] Add file deletion to git commit

**Priority 2 - Fix Environment Variables**:
- [ ] Update page.tsx to use NEXT_PUBLIC_API_URL
- [ ] Update LiveScanResults.tsx to use env var
- [ ] Create .env.local with API_URL
- [ ] Update .env.example with better comments
- [ ] Add required env var checks in config.js

**Priority 3 - Documentation Cleanup**:
- [ ] Create docs/ folder structure
- [ ] Move markdown files to docs/
- [ ] Create GETTING_STARTED.md
- [ ] Update README.md to point to docs/
- [ ] Add dev setup script

**Priority 4 - Naming Standardization**:
- [ ] Rename aiService.js → ai-service.js
- [ ] Update all imports
- [ ] Add .nvmrc file
- [ ] Review desktop/ folder structure

**Priority 5 - User Experience**:
- [ ] Create setup.js script
- [ ] Add dev:all npm script
- [ ] Test complete setup flow
- [ ] Document for both newcomers and experts

---

**Status After Fixes**: ✅ Professional, user-friendly, scalable

