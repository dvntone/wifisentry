const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Detect if running in Termux (Android terminal emulator)
 */
function isTermux() {
  try {
    const termuxPrefix = '/data/data/com.termux/files/usr';
    return fs.existsSync(termuxPrefix);
  } catch {
    return false;
  }
}

/**
 * Detect if running in WSL2 (Windows Subsystem for Linux)
 */
function isWSL2() {
  try {
    const wslCheck = execSync('grep -i microsoft /proc/version 2>/dev/null || echo ""', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return wslCheck.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

/**
 * Detect platform and environment
 */
function detectEnvironment() {
  const platform = os.platform();
  const termux = isTermux();
  const wsl2 = isWSL2();

  return {
    platform,
    isWindows: platform === 'win32',
    isMac: platform === 'darwin',
    isLinux: platform === 'linux',
    isTermux: termux,
    isWSL2: wsl2,
    environment: termux ? 'termux' : wsl2 ? 'wsl2' : platform
  };
}

/**
 * Installation helpers for different platforms
 */
const platformHelpers = {
  // Linux/Debian
  apt: {
    name: 'APT (Ubuntu/Debian)',
    getInstallCommand: (tool) => `sudo apt-get install -y ${tool}`,
    getUpdateCommand: () => 'sudo apt-get update',
    tools: {
      'aircrack-ng': 'aircrack-ng',
      'tcpdump': 'tcpdump',
      'python': 'python3',
      'nodejs': 'nodejs',
      'npm': 'npm',
      'git': 'git',
      'curl': 'curl',
      'wget': 'wget'
    }
  },

  // Termux (Android)
  apt_termux: {
    name: 'APT (Termux)',
    getInstallCommand: (tool) => `apt install -y ${tool}`,
    getUpdateCommand: () => 'apt update',
    tools: {
      'aircrack-ng': 'aircrack-ng',
      'tcpdump': 'tcpdump',
      'python': 'python',
      'nodejs': 'nodejs',
      'npm': 'npm',
      'git': 'git',
      'curl': 'curl',
      'wget': 'wget'
    }
  },

  // macOS
  brew: {
    name: 'Homebrew (macOS)',
    getInstallCommand: (tool) => `brew install ${tool}`,
    getUpdateCommand: () => 'brew update',
    checkInstall: () => {
      try {
        execSync('which brew', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    install: () => {
      console.log('Installing Homebrew...');
      const brewInstallURL = 'https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh';
      return execSync(`curl -fsSL ${brewInstallURL} | bash`, { encoding: 'utf-8' });
    },
    tools: {
      'aircrack-ng': 'aircrack-ng',
      'tcpdump': 'tcpdump',
      'python': 'python3',
      'nodejs': 'node',
      'npm': 'npm',
      'git': 'git',
      'curl': 'curl',
      'wget': 'wget'
    }
  },

  // Windows - Chocolatey
  choco: {
    name: 'Chocolatey (Windows)',
    getInstallCommand: (tool) => `choco install -y ${tool}`,
    getUpdateCommand: () => 'choco upgrade -y all',
    checkInstall: () => {
      try {
        execSync('where choco', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    install: async () => {
      console.log('Chocolatey not found. Visit https://chocolatey.org/install');
      return {
        success: false,
        error: 'Chocolatey required',
        instructions: 'Please install from: https://chocolatey.org/install',
        manualSteps: [
          'Open PowerShell as Administrator',
          'Run: Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://community.chocolatey.org/install.ps1\'))',
          'Restart your terminal',
          'Run: choco install -y [tool-name]'
        ]
      };
    },
    tools: {
      'aircrack-ng': 'aircrack-ng',
      'tcpdump': 'tcpdump',
      'python': 'python',
      'nodejs': 'nodejs',
      'npm': 'npm',
      'git': 'git',
      'curl': 'curl',
      'wget': 'wget'
    }
  },

  // Windows - WSL2
  wsl2: {
    name: 'WSL2 (Windows Subsystem for Linux)',
    getInstallCommand: (tool) => `wsl apt-get install -y ${tool}`,
    getUpdateCommand: () => 'wsl apt-get update',
    tools: {
      'aircrack-ng': 'aircrack-ng',
      'tcpdump': 'tcpdump',
      'python': 'python3',
      'nodejs': 'nodejs',
      'npm': 'npm',
      'git': 'git',
      'curl': 'curl',
      'wget': 'wget'
    }
  }
};

/**
 * Get installation helper for current environment
 */
function getEnvironmentHelper() {
  const env = detectEnvironment();

  if (env.isTermux) {
    return {
      platform: 'termux',
      helper: platformHelpers.apt_termux,
      setupSteps: [
        'Termux detected',
        'Using APT package manager',
        'WiFi monitoring may require Termux:Boot addon for background execution'
      ]
    };
  }

  if (env.isWSL2) {
    return {
      platform: 'wsl2',
      helper: platformHelpers.wsl2,
      setupSteps: [
        'WSL2 detected',
        'Using Linux subsystem',
        'Recommended: Install updates first with: wsl apt-get update'
      ]
    };
  }

  if (env.isMac) {
    if (platformHelpers.brew.checkInstall?.()) {
      return {
        platform: 'macos',
        helper: platformHelpers.brew,
        setupSteps: ['macOS detected', 'Homebrew is installed']
      };
    }

    return {
      platform: 'macos',
      helper: platformHelpers.brew,
      setupSteps: [
        'macOS detected',
        'Homebrew not found - will install first',
        'Internet connection required'
      ]
    };
  }

  if (env.isWindows) {
    if (platformHelpers.choco.checkInstall?.()) {
      return {
        platform: 'windows',
        helper: platformHelpers.choco,
        setupSteps: ['Windows detected', 'Chocolatey is installed']
      };
    }

    return {
      platform: 'windows',
      helper: null,
      setupSteps: [
        'Windows detected',
        'Requires either:',
        '1. Chocolatey package manager: https://chocolatey.org/install',
        '2. WSL2 with Linux subsystem: https://learn.microsoft.com/wsl/install'
      ],
      useWSL2: true
    };
  }

  // Default Linux
  return {
    platform: 'linux',
    helper: platformHelpers.apt,
    setupSteps: ['Linux detected', 'Using APT package manager']
  };
}

/**
 * Generate platform-specific installation script
 */
function generateInstallScript(toolIds, options = {}) {
  const env = getEnvironmentHelper();
  const helper = env.helper;

  if (!helper) {
    return {
      success: false,
      error: 'No package manager found',
      platform: env.platform,
      setupSteps: env.setupSteps,
      instructions: 'Please set up a package manager first'
    };
  }

  const commands = [];

  // Update package manager
  if (options.update) {
    commands.push({
      description: 'Update package manager',
      command: helper.getUpdateCommand()
    });
  }

  // Install each tool
  for (const toolId of toolIds) {
    const pkgName = helper.tools[toolId];
    if (pkgName) {
      commands.push({
        description: `Install ${toolId}`,
        command: helper.getInstallCommand(pkgName)
      });
    }
  }

  return {
    success: true,
    platform: env.platform,
    packageManager: helper.name,
    setupSteps: env.setupSteps,
    commands: commands,
    combinedScript: commands.map(c => c.command).join(' && '),
    environment: {
      isTermux: env.platform === 'termux',
      isWSL2: env.platform === 'wsl2',
      isWindows: env.platform === 'windows',
      isMac: env.platform === 'macos',
      isLinux: env.platform === 'linux'
    }
  };
}

/**
 * Get setup guide for development environment
 */
function getSetupGuide() {
  const env = detectEnvironment();
  const helper = getEnvironmentHelper();

  return {
    environment: env,
    helper: helper,
    guides: {
      termux: {
        title: 'Termux Setup Guide',
        requirements: [
          'Termux app from F-Droid or Google Play',
          'Termux:Styling (for better appearance)',
          'Termux:Boot (for background execution)'
        ],
        steps: [
          'Install dependencies: apt update && apt install -y nodejs npm git python3 curl',
          'Clone repo: git clone https://github.com/dvntone/wifisentry',
          'Install packages: npm install',
          'Configure: cp .env.example .env',
          'Edit .env with your settings',
          'Start: npm start'
        ],
        limitations: [
          'WiFi monitoring requires root access',
          'Some tools may require Magisk modules',
          'Background execution needs Termux:Boot'
        ]
      },

      wsl2: {
        title: 'WSL2 Setup Guide',
        requirements: [
          'Windows 10/11 with WSL2 enabled',
          'Linux distribution installed (Ubuntu recommended)'
        ],
        steps: [
          'Open WSL2 terminal',
          'Update system: sudo apt-get update && sudo apt-get upgrade',
          'Install dependencies: sudo apt-get install -y nodejs npm git python3 aircrack-ng tcpdump curl',
          'Clone repo: git clone https://github.com/dvntone/wifisentry',
          'Install packages: npm install',
          'Configure: cp .env.example .env',
          'Edit .env with your settings',
          'Start: npm start'
        ],
        advantages: [
          'Full Linux compatibility',
          'Direct Windows integration',
          'Better performance than VM'
        ]
      },

      macos: {
        title: 'macOS Setup Guide',
        requirements: [
          'Homebrew package manager',
          'Xcode Command Line Tools'
        ],
        steps: [
          'Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          'Install tools: brew install aircrack-ng tcpdump node python3 git curl',
          'Clone repo: git clone https://github.com/dvntone/wifisentry',
          'Install packages: npm install',
          'Configure: cp .env.example .env',
          'Edit .env with your settings',
          'Start: npm start'
        ],
        notes: [
          'Monitor mode may require System Extensions approval',
          'Intel vs Apple Silicon may affect tool availability'
        ]
      },

      windows: {
        title: 'Windows Setup Guide - WSL2 Recommended',
        requirements: [
          'Windows 10 (build 19041) or Windows 11',
          'Virtualization enabled in BIOS'
        ],
        steps: [
          'Enable WSL2: wsl --install (requires restart)',
          'Install Ubuntu from Microsoft Store',
          'Open Ubuntu terminal',
          'Update: sudo apt update && sudo apt upgrade',
          'Install: sudo apt install -y nodejs npm git python3 aircrack-ng tcpdump',
          'Proceed with deployment steps in WSL2'
        ],
        alternatives: [
          'Option 1: Use Chocolatey (requires Administrator)',
          'Option 2: Use Docker Desktop for Windows'
        ]
      },

      linux: {
        title: 'Linux Setup Guide',
        requirements: [
          'Ubuntu 20.04+ or equivalent',
          'sudo access for system packages'
        ],
        steps: [
          'Update system: sudo apt update && sudo apt upgrade',
          'Install tools: sudo apt install -y nodejs npm git python3 aircrack-ng tcpdump curl',
          'Clone repo: git clone https://github.com/dvntone/wifisentry',
          'Install packages: npm install',
          'Configure: cp .env.example .env',
          'Edit .env with your credentials',
          'Start backend: npm start',
          'In new terminal: cd web-app && npm run dev',
          'Open browser: http://localhost:3000'
        ],
        performance: [
          'Linux provides best WiFi scanning performance',
          'Direct hardware access without overhead',
          'Ideal for production deployment'
        ]
      }
    }
  };
}

/**
 * Check if all critical tools are available
 */
function checkCriticalTools() {
  const criticalTools = ['nodejs', 'npm', 'git', 'python'];
  const missing = [];

  for (const tool of criticalTools) {
    try {
      const checkCmd = tool === 'nodejs' ? 'node --version' :
                       tool === 'npm' ? 'npm --version' :
                       tool === 'python' ? 'python3 --version' :
                       `which ${tool}`;
      execSync(checkCmd, { stdio: 'ignore' });
    } catch {
      missing.push(tool);
    }
  }

  return {
    allPresent: missing.length === 0,
    missing,
    setupHelper: !missing.length ? null : getEnvironmentHelper()
  };
}

module.exports = {
  detectEnvironment,
  getEnvironmentHelper,
  generateInstallScript,
  getSetupGuide,
  checkCriticalTools,
  isTermux,
  isWSL2,
  platformHelpers
};
