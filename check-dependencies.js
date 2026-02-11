#!/usr/bin/env node

/**
 * WiFi Sentry - Dependency Installation CLI
 * 
 * Usage:
 *   node check-dependencies.js              # Check all dependencies
 *   node check-dependencies.js --install    # Interactive installation
 *   node check-dependencies.js --guide      # Show setup guide
 */

const dependencyChecker = require('./dependency-checker');
const platformInstaller = require('./platform-installer');
const { execSync } = require('child_process');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${colors.cyan}${question}${colors.reset} `, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function checkDependencies() {
  logSection('🔍 Checking System Dependencies');

  const report = dependencyChecker.checkAllDependencies();

  // Summary
  log(`Platform: ${report.platform}`, 'blue');
  log(`OS: ${report.os}`, 'blue');
  log(`Architecture: ${report.arch}\n`, 'blue');

  // Progress bar
  const progress = Math.round((report.stats.installed / report.stats.total) * 100);
  const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
  log(`Progress: [${bar}] ${progress}%`, report.stats.missing === 0 ? 'green' : 'yellow');

  log(`\nInstalled: ${report.stats.installed}/${report.stats.total}`, 'green');
  if (report.stats.missing > 0) {
    log(`Missing: ${report.stats.missing}`, 'red');
  }

  // Critical deps
  const critical = Object.entries(report.dependencies).filter(
    ([, dep]) => dep.priority === 'critical' && !dep.installed
  );

  if (critical.length > 0) {
    logSection('⚠️  Critical Dependencies Missing');
    critical.forEach(([toolId, dep]) => {
      log(`✗ ${dep.name}`, 'red');
      log(`  ${dep.description}`, 'yellow');
    });
  } else {
    log('\n✓ All critical dependencies installed!', 'green');
  }

  // Detailed list
  logSection('📦 Dependency Details');
  Object.entries(report.dependencies).forEach(([toolId, dep]) => {
    const icon = dep.installed ? '✓' : '✗';
    const color = dep.installed ? 'green' : 
                  dep.priority === 'critical' ? 'red' :
                  dep.priority === 'high' ? 'yellow' :
                  'blue';

    log(`${icon} ${dep.name} (${dep.priority})`, color);
  });

  return report;
}

async function interactiveInstall() {
  logSection('📥 Interactive Installation');

  const env = platformInstaller.getEnvironmentHelper();
  log(`Environment: ${env.platform}`, 'blue');
  log(`Package Manager: ${env.helper?.name || 'Not found'}`, 'blue');

  if (!env.helper) {
    log('\n⚠️  No package manager found for your system', 'red');
    log('Setup steps:', 'yellow');
    env.setupSteps.forEach((step, idx) => {
      log(`${idx + 1}. ${step}`, 'yellow');
    });
    return;
  }

  env.setupSteps.forEach((step, idx) => {
    log(`${idx + 1}. ${step}`, 'blue');
  });

  // Check critical tools
  const critical = platformInstaller.checkCriticalTools();
  
  if (critical.missing.length === 0) {
    log('\n✓ All critical tools already installed!', 'green');
    return;
  }

  log(`\n${critical.missing.length} critical tool(s) to install:`, 'yellow');
  critical.missing.forEach((tool, idx) => {
    log(`${idx + 1}. ${tool}`, 'yellow');
  });

  const proceed = await askQuestion('\nInstall these tools? (y/n):');
  if (proceed.toLowerCase() !== 'y') {
    log('Installation cancelled', 'yellow');
    return;
  }

  // Generate script
  const script = platformInstaller.generateInstallScript(critical.missing, { update: true });

  if (!script.success) {
    log(`\n⚠️  ${script.error}`, 'red');
    log(script.instructions, 'yellow');
    return;
  }

  log('\n📝 Commands to run:', 'blue');
  script.commands.forEach((cmd, idx) => {
    log(`\n${idx + 1}. ${cmd.description}`, 'cyan');
    log(`   ${cmd.command}`, 'reset');
  });

  const runCommands = await askQuestion('\nRun these commands now? (y/n):');
  if (runCommands.toLowerCase() !== 'y') {
    log('\nYou can run these commands manually later:', 'yellow');
    log(`\n${script.combinedScript}`, 'reset');
    return;
  }

  logSection('⏳ Installing...');
  
  try {
    for (const cmd of script.commands) {
      log(`\n▶ ${cmd.description}...`, 'blue');
      execSync(cmd.command, { stdio: 'inherit' });
      log(`✓ ${cmd.description} complete`, 'green');
    }

    log('\n✓ Installation complete!', 'green');
    log('Verifying installation...', 'blue');

    // Re-check
    setTimeout(() => {
      const report = dependencyChecker.checkAllDependencies();
      if (report.stats.missing === 0) {
        log('✓ All dependencies installed successfully!', 'green');
      } else {
        log(`⚠️  ${report.stats.missing} dependencies still missing`, 'yellow');
      }
    }, 2000);

  } catch (error) {
    log(`\n✗ Installation failed: ${error.message}`, 'red');
    log('Try running the commands manually', 'yellow');
  }
}

async function showGuide() {
  logSection('📖 Setup Guide');

  const guide = platformInstaller.getSetupGuide();
  const platformKey = guide.environment.environment;
  const platformGuide = guide.guides[platformKey];

  if (!platformGuide) {
    log(`No guide available for ${platformKey}`, 'yellow');
    return;
  }

  log(`Platform: ${platformGuide.title}`, 'cyan');

  if (platformGuide.requirements) {
    log('\n📋 Requirements:', 'blue');
    platformGuide.requirements.forEach(req => {
      log(`  • ${req}`, 'reset');
    });
  }

  if (platformGuide.steps) {
    log('\n🔧 Installation Steps:', 'blue');
    platformGuide.steps.forEach((step, idx) => {
      log(`  ${idx + 1}. ${step}`, 'reset');
    });
  }

  if (platformGuide.advantages) {
    log('\n✨ Advantages:', 'green');
    platformGuide.advantages.forEach(adv => {
      log(`  ✓ ${adv}`, 'green');
    });
  }

  if (platformGuide.limitations) {
    log('\n⚠️  Limitations:', 'yellow');
    platformGuide.limitations.forEach(lim => {
      log(`  • ${lim}`, 'yellow');
    });
  }

  if (platformGuide.performance) {
    log('\n⚡ Performance:', 'cyan');
    platformGuide.performance.forEach(perf => {
      log(`  • ${perf}`, 'cyan');
    });
  }
}

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--install')) {
      await interactiveInstall();
    } else if (args.includes('--guide')) {
      await showGuide();
    } else {
      const report = await checkDependencies();

      logSection('💡 Available Commands');
      log('node check-dependencies.js --install', 'cyan');
      log('  → Interactive installation wizard', 'reset');
      log('\nnode check-dependencies.js --guide', 'cyan');
      log('  → Show platform-specific setup guide', 'reset');
      log('\nnode scripts/setup.js', 'cyan');
      log('  → Run full project setup', 'reset');
    }
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
