const { execSync, exec } = require('child_process');
const os = require('os');
const path = require('path');

const PLATFORM = os.platform();
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';

/**
 * Dependency definitions for different platforms
 */
const DEPENDENCIES = {
  // Core WiFi monitoring tools
  'aircrack-ng': {
    name: 'Aircrack-ng',
    description: 'WiFi monitoring and cracking suite',
    priority: 'critical',
    linux: {
      check: 'which airmon-ng',
      install: 'sudo apt-get install -y aircrack-ng'
    },
    mac: {
      check: 'which aircrack-ng',
      install: 'brew install aircrack-ng'
    },
    windows: {
      check: 'where aircrack-ng',
      install: 'choco install aircrack-ng -y',
      wsl: 'sudo apt-get install -y aircrack-ng'
    }
  },
  
  'tcpdump': {
    name: 'tcpdump',
    description: 'Network packet analyzer',
    priority: 'critical',
    linux: {
      check: 'which tcpdump',
      install: 'sudo apt-get install -y tcpdump'
    },
    mac: {
      check: 'which tcpdump',
      install: 'brew install tcpdump'
    },
    windows: {
      check: 'where tcpdump',
      install: 'choco install tcpdump -y',
      wsl: 'sudo apt-get install -y tcpdump'
    }
  },

  'python': {
    name: 'Python 3',
    description: 'Required for WiFi analysis scripts',
    priority: 'high',
    linux: {
      check: 'python3 --version',
      install: 'sudo apt-get install -y python3'
    },
    mac: {
      check: 'python3 --version',
      install: 'brew install python3'
    },
    windows: {
      check: 'python --version',
      install: 'choco install python -y'
    }
  },

  'nodejs': {
    name: 'Node.js',
    description: 'Runtime for WiFi Sentry backend',
    priority: 'critical',
    linux: {
      check: 'node --version',
      install: 'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs'
    },
    mac: {
      check: 'node --version',
      install: 'brew install node'
    },
    windows: {
      check: 'node --version',
      install: 'choco install nodejs -y'
    }
  },

  'npm': {
    name: 'npm',
    description: 'Node Package Manager',
    priority: 'critical',
    linux: {
      check: 'npm --version',
      install: 'sudo apt-get install -y npm'
    },
    mac: {
      check: 'npm --version',
      install: 'brew install npm'
    },
    windows: {
      check: 'npm --version',
      install: 'choco install npm -y'
    }
  },

  'git': {
    name: 'Git',
    description: 'Version control system',
    priority: 'high',
    linux: {
      check: 'which git',
      install: 'sudo apt-get install -y git'
    },
    mac: {
      check: 'which git',
      install: 'brew install git'
    },
    windows: {
      check: 'where git',
      install: 'choco install git -y'
    }
  },

  'curl': {
    name: 'curl',
    description: 'Command line URL tool for API requests',
    priority: 'medium',
    linux: {
      check: 'which curl',
      install: 'sudo apt-get install -y curl'
    },
    mac: {
      check: 'which curl',
      install: 'brew install curl'
    },
    windows: {
      check: 'where curl',
      install: 'choco install curl -y'
    }
  },

  'wget': {
    name: 'wget',
    description: 'File download tool',
    priority: 'low',
    linux: {
      check: 'which wget',
      install: 'sudo apt-get install -y wget'
    },
    mac: {
      check: 'which wget',
      install: 'brew install wget'
    },
    windows: {
      check: 'where wget',
      install: 'choco install wget -y'
    }
  }
};

/**
 * Check if a tool is installed
 * @param {string} toolId - Tool identifier
 * @param {string} platform - 'linux' | 'mac' | 'windows'
 * @returns {boolean} - True if installed
 */
function checkToolInstalled(toolId, platform = PLATFORM) {
  try {
    const dep = DEPENDENCIES[toolId];
    if (!dep) return false;

    let checkCmd;
    if (platform === 'win32' || platform === 'windows') {
      checkCmd = dep.windows?.check;
    } else if (platform === 'darwin' || platform === 'mac') {
      checkCmd = dep.mac?.check;
    } else {
      checkCmd = dep.linux?.check;
    }

    if (!checkCmd) return false;

    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get installation instructions for a tool
 * @param {string} toolId - Tool identifier
 * @returns {object} - Installation instructions
 */
function getInstallationInstructions(toolId) {
  const dep = DEPENDENCIES[toolId];
  if (!dep) return null;

  const instructions = {
    name: dep.name,
    description: dep.description,
    priority: dep.priority,
    platform: PLATFORM,
    commands: [],
    notes: []
  };

  if (PLATFORM === 'win32') {
    if (dep.windows?.wsl) {
      instructions.commands.push({
        type: 'wsl',
        command: dep.windows.wsl,
        description: 'Run in WSL2 (Linux subsystem for Windows)'
      });
      instructions.notes.push('WSL2 is recommended for WiFi monitoring tools on Windows');
    }
    if (dep.windows?.install) {
      instructions.commands.push({
        type: 'choco',
        command: dep.windows.install,
        description: 'Run with Chocolatey package manager'
      });
      instructions.notes.push('Requires Chocolatey. Install from: https://chocolatey.org/install');
    }
  } else if (PLATFORM === 'darwin') {
    if (dep.mac?.install) {
      instructions.commands.push({
        type: 'brew',
        command: dep.mac.install,
        description: 'Run with Homebrew'
      });
      instructions.notes.push('Requires Homebrew. Install from: https://brew.sh');
    }
  } else if (PLATFORM === 'linux') {
    if (dep.linux?.install) {
      instructions.commands.push({
        type: 'apt',
        command: dep.linux.install,
        description: 'Run in Linux terminal'
      });
      instructions.notes.push('For Ubuntu/Debian. Other distros may use different package managers.');
    }
  }

  return instructions;
}

/**
 * Check all dependencies and return status
 * @returns {object} - Dependency status report
 */
function checkAllDependencies() {
  const report = {
    platform: PLATFORM,
    timestamp: new Date().toISOString(),
    os: os.type(),
    arch: os.arch(),
    stats: {
      total: 0,
      installed: 0,
      missing: 0
    },
    dependencies: {}
  };

  for (const toolId in DEPENDENCIES) {
    const isInstalled = checkToolInstalled(toolId);
    const dep = DEPENDENCIES[toolId];

    report.dependencies[toolId] = {
      name: dep.name,
      description: dep.description,
      priority: dep.priority,
      installed: isInstalled,
      installationInstructions: !isInstalled ? getInstallationInstructions(toolId) : null
    };

    report.stats.total++;
    if (isInstalled) {
      report.stats.installed++;
    } else {
      report.stats.missing++;
    }
  }

  return report;
}

/**
 * Get critical missing dependencies
 * @returns {array} - List of critical missing tools
 */
function getCriticalMissingDependencies() {
  const missing = [];

  for (const toolId in DEPENDENCIES) {
    const dep = DEPENDENCIES[toolId];
    if (dep.priority === 'critical' && !checkToolInstalled(toolId)) {
      missing.push({
        toolId,
        name: dep.name,
        description: dep.description,
        instructions: getInstallationInstructions(toolId)
      });
    }
  }

  return missing;
}

/**
 * Install a tool interactively
 * @param {string} toolId - Tool identifier
 * @param {object} options - Installation options
 * @returns {promise} - Installation result
 */
function installDependency(toolId, options = {}) {
  return new Promise((resolve, reject) => {
    const dep = DEPENDENCIES[toolId];
    if (!dep) {
      reject(new Error(`Unknown dependency: ${toolId}`));
      return;
    }

    let installCmd;
    if (PLATFORM === 'win32') {
      if (options.useWSL && dep.windows?.wsl) {
        installCmd = `wsl ${dep.windows.wsl}`;
      } else if (dep.windows?.install) {
        installCmd = dep.windows.install;
      }
    } else if (PLATFORM === 'darwin') {
      installCmd = dep.mac?.install;
    } else {
      installCmd = dep.linux?.install;
    }

    if (!installCmd) {
      reject(new Error(`No installation command available for ${dep.name}`));
      return;
    }

    exec(installCmd, (error, stdout, stderr) => {
      if (error) {
        reject({
          success: false,
          error: error.message,
          stderr: stderr,
          hint: `Installation failed. You may need to run: ${installCmd}`
        });
      } else {
        resolve({
          success: true,
          message: `${dep.name} installed successfully`,
          stdout: stdout
        });
      }
    });
  });
}

module.exports = {
  checkAllDependencies,
  getCriticalMissingDependencies,
  checkToolInstalled,
  getInstallationInstructions,
  installDependency,
  DEPENDENCIES,
  PLATFORM
};
