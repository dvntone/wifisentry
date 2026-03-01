#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isDev = !process.argv.includes('--prod');
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

function runCommand(cmd, description) {
  try {
    log(`⏳ ${description}...`);
    execSync(cmd, { stdio: 'inherit' });
    log(`✓ ${description}`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${description} failed`, 'red');
    return false;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Main setup
async function setup() {
  log('\n🔧 WiFi Sentry Setup\n', 'blue');

  logSection('1. Checking Prerequisites');

  // Check Node version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    const match = nodeVersion.match(/v(\d+)/);
    const majorVersion = parseInt(match[1]);
    
    if (majorVersion < 18) {
      log(`✗ Node.js 18+ required (you have ${nodeVersion})`, 'red');
      process.exit(1);
    }
    log(`✓ Node.js ${nodeVersion}`, 'green');
  } catch (error) {
    log('✗ Node.js not found', 'red');
    process.exit(1);
  }

  logSection('2. Installing Dependencies');

  // Backend dependencies
  if (!runCommand('npm install', 'Installing backend dependencies')) {
    process.exit(1);
  }

  // Frontend dependencies
  if (!runCommand('cd web-app && npm install', 'Installing frontend dependencies')) {
    process.exit(1);
  }

  logSection('3. Configuring Environment');

  // Create .env if it doesn't exist
  if (!fileExists('.env')) {
    log('Creating .env file from template...', 'yellow');
    fs.copyFileSync('.env.example', '.env');
    log('✓ .env file created - EDIT IT NOW with your credentials!', 'yellow');
  } else {
    log('✓ .env file already exists', 'green');
  }

  // Create web-app/.env.local if it doesn't exist
  if (!fileExists('web-app/.env.local')) {
    log('Creating web-app/.env.local...', 'yellow');
    fs.writeFileSync('web-app/.env.local', 'NEXT_PUBLIC_API_URL=http://localhost:3000\n');
    log('✓ web-app/.env.local created', 'green');
  } else {
    log('✓ web-app/.env.local exists', 'green');
  }

  logSection('4. Verification');

  // Check key files exist
  const requiredFiles = [
    'server.js',
    'package.json',
    'web-app/package.json',
    'config.js',
    '.env'
  ];

  let allOk = true;
  for (const file of requiredFiles) {
    if (fileExists(file)) {
      log(`✓ ${file}`, 'green');
    } else {
      log(`✗ ${file} missing!`, 'red');
      allOk = false;
    }
  }

  if (!allOk) {
    log('\n⚠️  Some required files are missing!', 'red');
    process.exit(1);
  }

  logSection('✅ Setup Complete!');
  log('\nNext steps:', 'yellow');
  log('\n1. Edit .env with your credentials:\n   - ADMIN_PASSWORD (required)\n   - SESSION_SECRET (recommended)\n   - GOOGLE_GEMINI_API_KEY (optional)\n', 'reset');
  log('2. Start development:\n   npm run dev:all\n', 'reset');
  log('3. Open:\n   http://localhost:3000\n', 'green');
  log('For more info, see docs/GETTING_STARTED.md\n', 'reset');
}

setup().catch(error => {
  log(`\n✗ Setup failed: ${error.message}`, 'red');
  process.exit(1);
});
