# WiFi Sentry - Dependency System Quick Reference

## 🚀 Quick Start

### For End Users
```bash
# Check dependencies
npm run check-deps

# Interactive setup
npm run check-deps -- --install

# Platform guide
npm run check-deps -- --guide
```

### For Developers

**Import & Use:**
```javascript
// Backend
const dependencyChecker = require('./dependency-checker');
const platformInstaller = require('./platform-installer');

// Check
const report = dependencyChecker.checkAllDependencies();

// Install
dependencyChecker.installDependency('aircrack-ng')
  .then(result => console.log(result))
  .catch(error => console.error(error));

// Get guide
const guide = platformInstaller.getSetupGuide();
```

**React Component:**
```jsx
import DependencyChecker from '@/components/DependencyChecker';
import SetupWizard from '@/components/SetupWizard';

<DependencyChecker apiBase="http://localhost:3000/api" />
<SetupWizard onSetupComplete={() => navigate('/scan')} />
```

## 📋 Core Functions

### `dependency-checker.js`

| Function | Returns | Purpose |
|----------|---------|---------|
| `checkAllDependencies()` | `{platform, stats, dependencies}` | Full scan |
| `getCriticalMissingDependencies()` | `[{name, instructions}]` | Critical only |
| `checkToolInstalled(toolId)` | `boolean` | Single tool check |
| `getInstallationInstructions(toolId)` | `{commands, notes}` | How to install |
| `installDependency(toolId, options)` | `Promise` | Run installation |

### `platform-installer.js`

| Function | Returns | Purpose |
|----------|---------|---------|
| `detectEnvironment()` | `{platform, isWSL2, isTermux, ...}` | Detect OS |
| `getEnvironmentHelper()` | `{platform, helper, setupSteps}` | Get PM |
| `generateInstallScript(tools)` | `{success, commands}` | Make script |
| `getSetupGuide()` | `{environment, guides}` | Setup steps |
| `checkCriticalTools()` | `{allPresent, missing}` | Quick check |

## 🌐 API Endpoints

### GET `/api/dependencies/check`
Returns full dependency report
```json
{
  "platform": "linux",
  "stats": { "total": 10, "installed": 8, "missing": 2 },
  "dependencies": { ... }
}
```

### GET `/api/dependencies/critical`
Only critical missing tools
```json
{
  "hasCriticalMissing": true,
  "count": 2,
  "dependencies": [...]
}
```

### POST `/api/setup/install-script`
Generate installation script
```json
Body: { "toolIds": ["aircrack-ng"], "update": true }
→ { "success": true, "commands": [...], "combinedScript": "..." }
```

### GET `/api/setup/environment`
Platform detection + guides
```json
{
  "environment": { "isTermux": false, "isWSL2": true, ... },
  "guides": { "wsl2": { "steps": [...] } }
}
```

### POST `/api/dependencies/:toolId/install`
Attempt single tool installation
```json
Body: { "useWSL": true }
→ { "success": true, "message": "..." }
```

## 🛠️ Common Tasks

### Add New Tool
Edit `dependency-checker.js`:
```javascript
const DEPENDENCIES = {
  'new-tool': {
    name: 'New Tool',
    description: 'What it does',
    priority: 'high', // critical|high|medium|low
    linux: {
      check: 'which new-tool',
      install: 'sudo apt-get install -y new-tool'
    },
    mac: {
      check: 'which new-tool',
      install: 'brew install new-tool'
    },
    windows: {
      check: 'where new-tool',
      install: 'choco install new-tool -y',
      wsl: 'sudo apt-get install -y new-tool'
    }
  }
};
```

### Add Platform Guide
Edit `platform-installer.js` → `getSetupGuide()`:
```javascript
guides: {
  'my-platform': {
    title: 'My Platform Setup',
    requirements: [...],
    steps: [...],
    advantages: [...]
  }
}
```

### Integrate in Component
```jsx
import DependencyChecker from '@/components/DependencyChecker';

export default function Dashboard() {
  return (
    <>
      <DependencyChecker 
        onComplete={(report) => {
          if (!report.stats.missing) {
            enableScanning();
          }
        }}
      />
    </>
  );
}
```

## 🔍 Debugging

### Check Debug Output
```bash
# Verbose platform detection
node -e "console.log(require('./platform-installer').detectEnvironment())"

# List all dependencies
node -e "console.log(Object.keys(require('./dependency-checker').DEPENDENCIES))"

# Frontend console
window.fetch('/api/dependencies/check').then(r => r.json()).then(console.log)
```

### Test Installation
```bash
# Test single tool detection
node -e "console.log(require('./dependency-checker').checkToolInstalled('nodejs'))"

# Test installation script generation
node -e "console.log(JSON.stringify(require('./platform-installer').generateInstallScript(['aircrack-ng']), null, 2))"
```

## 📊 Response Status Codes

| Code | Meaning | Response |
|------|---------|----------|
| 200 | Success | Check/install result |
| 404 | Not found | Unknown tool ID |
| 500 | Server error | Check/install failed |

## 🎯 Dependency Priorities

- **critical** - WiFi Sentry won't work
- **high** - Many features won't work
- **medium** - Some features won't work
- **low** - Optional features

## 🌍 Platform Detection Order

1. Check WSL2: `/proc/version` contains "microsoft"
2. Check Termux: `/data/data/com.termux/files/usr` exists
3. Check OS: `os.platform()` returns: win32, darwin, linux
4. Default to Linux

## 💾 Install Commands Format

```javascript
{
  type: 'apt'|'brew'|'choco'|'wsl',              // Package manager
  command: 'sudo apt-get install -y aircrack-ng', // Full command
  description: 'Install aircrack-ng'             // What it does
}
```

## 🔐 Security Checklist

- ✓ No auto-install (ask first)
- ✓ Show commands before running
- ✓ Handle errors gracefully
- ✓ Verify after install
- ✓ No credentials stored
- ✓ No shell substitution
- ✓ Timeout long operations

## 📚 Related Docs

| Document | Purpose |
|----------|---------|
| `docs/DEPENDENCY_MANAGEMENT.md` | Complete reference (400 lines) |
| `SETUP_INTEGRATION_GUIDE.md` | How it works + examples (350 lines) |
| `DEPENDENCY_SYSTEM_SUMMARY.md` | Implementation details |
| This file | Quick reference |<br/>

## 🔄 Common Workflows

### Check & Prompt User
```javascript
const report = await fetch('/api/dependencies/check').then(r => r.json());
if (report.stats.missing > 0) {
  showDependencyChecker(); // React component
}
```

### Generate Install Commands
```javascript
const script = await fetch('/api/setup/install-script', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toolIds: ['aircrack-ng', 'tcpdump'],
    update: true
  })
}).then(r => r.json());

// script.commands has individual commands
// script.combinedScript has them all together
```

### Auto-Install (if permitted)
```javascript
const result = await fetch('/api/dependencies/nodejs/install', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ useWSL: true })
}).then(r => r.json());

if (result.success) {
  console.log('✓ Installed:', result.message);
} else {
  console.log('✗ Failed:', result.error);
}
```

## 🎨 Component Props

### DependencyChecker
```jsx
<DependencyChecker
  apiBase="http://localhost:3000/api"  // Optional
  onComplete={(report) => {...}}       // Optional callback
/>
```

### SetupWizard
```jsx
<SetupWizard
  apiBase="http://localhost:3000/api"  // Optional
  onSetupComplete={() => {...}}        // Optional callback
/>
```

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Command not found" | `source ~/.bashrc` + restart |
| WSL2 not detected | Check `grep -i microsoft /proc/version` |
| Termux not working | Need root via Magisk or Termux:Privileged |
| macOS M1 issues | Try `arch -arm64 brew install` vs `arch -x86_64` |
| npm install fails | Run `npm install` again or check internet |

## 🚀 Performance Tips

- Cache `/api/dependencies/check` response
- Only re-check on demand (button click)
- Use `/api/dependencies/critical` for quick check
- Parallel API calls where possible
- Lazy-load SetupWizard component

---

**Keep this handy while developing!**
