# WiFi Sentry - Automated Dependency Management

This document explains how WiFi Sentry automatically scans, detects, and manages system dependencies across Windows, macOS, Linux, WSL2, and Termux.

## 🎯 Overview

WiFi Sentry includes a comprehensive automated system that:

1. **Scans System** - Detects your OS, architecture, and platform
2. **Checks Dependencies** - Verifies all required and optional tools are installed
3. **Prompts User** - Asks for permission before installing anything
4. **Guides Installation** - Provides platform-specific commands and instructions
5. **Verifies Installation** - Confirms tools installed successfully

## 📦 Core Modules

### 1. `dependency-checker.js`
Backend module that checks if tools are installed.

**Functions:**
```javascript
// Check all dependencies
checkAllDependencies() → { platform, stats, dependencies }

// Get critical missing dependencies
getCriticalMissingDependencies() → [{ name, instructions }]

// Check single tool
checkToolInstalled(toolId) → boolean

// Install a tool programmatically
installDependency(toolId, options) → Promise
```

### 2. `platform-installer.js`
Detects environment and generates platform-specific installation commands.

**Functions:**
```javascript
// Detect Windows/WSL2/Linux/macOS/Termux
detectEnvironment() → { platform, isTermux, isWSL2, ... }

// Get appropriate package manager for system
getEnvironmentHelper() → { platform, helper, setupSteps }

// Generate installation script
generateInstallScript(toolIds, options) → { success, commands, combinedScript }

// Get setup guide for detected platform
getSetupGuide() → { environment, guides }

// Check if critical tools exist
checkCriticalTools() → { allPresent, missing }
```

### 3. `check-dependencies.js`
CLI tool for interactive dependency management.

**Usage:**
```bash
# Check dependencies
node check-dependencies.js

# Interactive installation
node check-dependencies.js --install

# Show setup guide
node check-dependencies.js --guide
```

## 🎨 Frontend Components

### `DependencyChecker.tsx`
Shows dependency status in a beautiful UI.

Features:
- Real-time dependency scanning
- Installation status display
- Individual tool expansion
- Platform-specific instructions
- One-click installation

```jsx
<DependencyChecker 
  apiBase="http://localhost:3000/api"
  onComplete={(report) => console.log(report)}
/>
```

### `SetupWizard.tsx`
Interactive multi-step setup wizard.

Features:
- Environment detection
- Tool selection
- Installation command generation
- Step-by-step guide
- Progress tracking

```jsx
<SetupWizard 
  apiBase="http://localhost:3000/api"
  onSetupComplete={() => startMonitoring()}
/>
```

## 🌐 REST API Endpoints

All endpoints are prefixed with `/api/`

### Dependency Checking
```
GET /dependencies/check
- Returns full dependency report with all tools

GET /dependencies/critical
- Returns only critical missing dependencies

GET /dependencies/:toolId/install
- Returns installation instructions for specific tool

POST /dependencies/:toolId/install
- Attempts to install a specific tool
```

### Platform Setup
```
GET /setup/environment
- Returns environment detection and setup guides

POST /setup/install-script
- Body: { toolIds: [], update: true }
- Generates installation script for selected tools

GET /setup/check-critical
- Checks if all critical tools are available
```

## 🔧 Supported Platforms

### Windows
**Recommended:** WSL2 with Ubuntu/Debian

**Options:**
1. **WSL2** (recommended)
   - Full Linux compatibility
   - Direct Windows integration
   - Uses `apt` package manager
   - Command: `wsl apt-get install -y [tool]`

2. **Chocolatey**
   - Windows native package manager
   - Requires administrator access
   - Command: `choco install -y [tool]`

### macOS
**Package Manager:** Homebrew

- Auto-installs Homebrew if not found
- Command: `brew install [tool]`
- Supports both Intel and Apple Silicon

### Linux (Ubuntu/Debian)
**Package Manager:** APT

- Direct hardware access
- Best performance
- Command: `sudo apt-get install -y [tool]`

### Termux (Android)
**Package Manager:** APT (Termux variant)

- Mobile development environment
- Separate filesystem from Android
- Command: `apt install -y [tool]`
- Recommended addons:
  - Termux:Boot (for background execution)
  - Termux:Styling (for better UX)

## 📋 Managed Dependencies

### Critical (Required)
- **Node.js** - Backend runtime
- **npm** - Package manager
- **aircrack-ng** - WiFi monitoring tools
- **tcpdump** - Packet capture

### High Priority
- **Python 3** - Analysis scripts
- **Git** - Version control

### Medium & Low
- curl, wget - Download tools
- Various development headers

## 🚀 Usage Examples

### 1. In React Components
```jsx
import DependencyChecker from '@/components/DependencyChecker';

export default function Dashboard() {
  return (
    <div>
      <DependencyChecker />
      {/* Rest of dashboard */}
    </div>
  );
}
```

### 2. CLI Scanning
```bash
# Check dependencies
node check-dependencies.js

# Output:
# ============================================================
# 🔍 Checking System Dependencies
# ============================================================
# Platform: linux
# OS: Linux
# Architecture: x64
# 
# Progress: [████████████████████] 100%
# Installed: 10/10
```

### 3. Interactive Installation
```bash
node check-dependencies.js --install

# Prompts:
# 1. Detects environment
# 2. Shows critical missing tools
# 3. Asks permission to install
# 4. Runs installation commands
# 5. Verifies installation
```

### 4. Platform Setup Guide
```bash
node check-dependencies.js --guide

# Shows platform-specific steps with:
# - Requirements
# - Step-by-step instructions
# - Copy-to-clipboard commands
# - Performance notes
# - Limitations
```

### 5. Backend API Check
```bash
# Get full dependency report
curl http://localhost:3000/api/dependencies/check

# Get critical missing
curl http://localhost:3000/api/dependencies/critical

# Generate install script
curl -X POST http://localhost:3000/api/setup/install-script \
  -H "Content-Type: application/json" \
  -d '{"toolIds": ["aircrack-ng", "tcpdump"], "update": true}'
```

## 🎬 First-Time User Flow

```
1. User opens WiFi Sentry
2. Page loads with DependencyChecker component
3. Component calls /api/dependencies/check
4. Shows progress: "Checking system dependencies..."
5. Results display:
   - ✓ Installed tools in green
   - ✗ Missing tools in red
   - Critical missing tools highlighted with warning
6. If critical missing:
   - Show SetupWizard component
   - User selects tools to install
   - Wizard generates platform-specific commands
   - User sees step-by-step guide
   - User copies commands to terminal
   - User runs installation
   - WiFi Sentry re-checks and confirms
7. All dependency installed:
   - Show "Ready to monitor" button
   - Enable WiFi scanning features
   - Start threat detection
```

## 🛠️ Configuration

### Adding New Dependencies

Edit `dependency-checker.js` `DEPENDENCIES` object:

```javascript
const DEPENDENCIES = {
  'my-tool': {
    name: 'My Tool',
    description: 'Does something awesome',
    priority: 'high',
    linux: {
      check: 'which my-tool',
      install: 'sudo apt-get install -y my-tool'
    },
    mac: {
      check: 'which my-tool',
      install: 'brew install my-tool'
    },
    windows: {
      check: 'where my-tool',
      install: 'choco install my-tool -y',
      wsl: 'sudo apt-get install -y my-tool'
    }
  }
};
```

### Customizing Installation Messages

Edit prompts in `SetupWizard.tsx` and `DependencyChecker.tsx` for custom UI.

### Platform-Specific Setup Guides

Edit `platform-installer.js` `platformHelpers` or `getSetupGuide()` function.

## 📊 Dependency Check Output

```json
{
  "platform": "linux",
  "os": "Linux",
  "arch": "x64",
  "timestamp": "2024-02-11T10:30:00Z",
  "stats": {
    "total": 9,
    "installed": 7,
    "missing": 2
  },
  "dependencies": {
    "nodejs": {
      "name": "Node.js",
      "description": "Runtime for WiFi Sentry backend",
      "priority": "critical",
      "installed": true
    },
    "aircrack-ng": {
      "name": "Aircrack-ng",
      "description": "WiFi monitoring and cracking suite",
      "priority": "critical",
      "installed": false,
      "installationInstructions": {
        "platform": "linux",
        "commands": [
          {
            "type": "apt",
            "command": "sudo apt-get install -y aircrack-ng",
            "description": "Run in Linux terminal"
          }
        ],
        "notes": ["For Ubuntu/Debian..."]
      }
    }
  }
}
```

## 🔒 Security Considerations

1. **No Automatic Installation** - Always asks user permission
2. **Clear Commands** - Shows exact commands being run
3. **Error Handling** - Never runs commands silently
4. **Permission Checks** - Detects when sudo required
5. **Verification** - Confirms installation success
6. **No Credentials** - Never stores sensitive data

## 🐛 Troubleshooting

### "Command not found" after installation
- Try: `source ~/.bashrc` (Linux/WSL2)
- Or: `source ~/.zshrc` (macOS with zsh)
- Or: Restart terminal window

### WSL2 not detected on Windows
- Verify WSL2 installed: `wsl --version`
- Check `/proc/version` contains "Microsoft"
- Try manual WSL2 path in setup

### Termux-specific issues
- Tools may need root: `sudo apt install -y [tool]`
- Or use Magisk modules for system access
- See Termux documentation

### macOS M1/M2 Intel compatibility
- Some tools only available for one architecture
- Try: `arch -arm64 brew install [tool]` (native)
- Or: `arch -x86_64 brew install [tool]` (Rosetta)

## 📚 Related Files

- Backend: `server.js` (API endpoints)
- Frontend: `web-app/src/components/` (React components)
- CLI: `check-dependencies.js` (Command-line tool)
- Core: `dependency-checker.js`, `platform-installer.js`
- Docs: `SETUP_GUIDE.md`, `INSTALLATION.md`

## 🔄 Updating Dependencies

To check for updates to all tools:

```bash
# Windows/WSL2
wsl sudo apt-get update && wsl sudo apt-get upgrade

# macOS
brew update && brew upgrade

# Linux
sudo apt-get update && sudo apt-get upgrade

# Termux
apt update && apt upgrade
```

## ✅ Best Practices

1. ✓ Run dependency check on first launch
2. ✓ Re-check before major operations
3. ✓ Keep tools updated regularly
4. ✓ Document any platform-specific issues
5. ✓ Test on target platform before release
6. ✓ Provide clear error messages to users
7. ✓ Never install without user consent

## 📞 Support

For issues with:
- **Dependency detection**: Check `check-dependencies.js --install`
- **Platform setup**: Run `check-dependencies.js --guide`
- **Installation**: See `INSTALLATION.md`
- **Platform-specific**: See platform setup guides
