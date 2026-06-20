const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('==================================================');
console.log('🚀  Archeio Setup Wizard');
console.log('==================================================\n');

const runCommand = (command, options = {}) => {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
};

// 1. Install Node.js dependencies
console.log('📦 Setting up frontend dependencies...');
const frontendDir = path.join(__dirname, 'frontend');
if (!runCommand('npm install', { cwd: frontendDir })) {
  console.error('❌ Failed to install frontend dependencies.');
  process.exit(1);
}

console.log('\n📦 Setting up backend dependencies...');
const backendDir = path.join(__dirname, 'backend');
if (!runCommand('npm install', { cwd: backendDir })) {
  console.error('❌ Failed to install backend dependencies.');
  process.exit(1);
}

// 2. Setup Python Virtual Environment
console.log('\n🐍 Setting up Python Virtual Environment...');
let pythonCmd = 'python';
try {
  execSync('python3 --version', { stdio: 'ignore' });
  pythonCmd = 'python3';
} catch (e) {
  // Fallback to python
}

const venvDir = path.join(__dirname, 'venv');
if (!fs.existsSync(venvDir)) {
  console.log(`Creating virtual environment with ${pythonCmd}...`);
  if (!runCommand(`${pythonCmd} -m venv venv`, { cwd: __dirname })) {
    console.error('❌ Failed to create Python virtual environment. Please ensure Python 3 is installed.');
    process.exit(1);
  }
} else {
  console.log('Python virtual environment already exists.');
}

const pipPath = os.platform() === 'win32'
  ? path.join(__dirname, 'venv', 'Scripts', 'pip')
  : path.join(__dirname, 'venv', 'bin', 'pip');

console.log('Installing python libraries (pillow, pillow_heif)...');
if (!runCommand(`"${pipPath}" install pillow pillow_heif`)) {
  console.error('❌ Failed to install Python dependencies.');
  process.exit(1);
}

// 3. Create env file for frontend if missing
const envPath = path.join(frontendDir, '.env');
if (!fs.existsSync(envPath)) {
  console.log('\n⚙️  Creating default frontend .env file...');
  fs.writeFileSync(envPath, 'VITE_API_URL=http://localhost:3001\n');
  console.log('Created frontend/.env with default settings.');
}

// 4. Check for system dependencies
console.log('\n🔍 Checking system prerequisites (convert engines)...');
const isWin = os.platform() === 'win32';

const checkBinary = (names) => {
  for (const name of names) {
    const cmd = isWin ? `where ${name}` : `which ${name}`;
    try {
      execSync(cmd, { stdio: 'ignore' });
      return true;
    } catch (e) {
      // Try next candidate
    }
  }
  return false;
};

const missing = [];

// Check LibreOffice
if (!checkBinary(['soffice', 'soffice.exe'])) {
  missing.push({
    name: 'LibreOffice',
    mac: 'brew install --cask libreoffice',
    linux: 'sudo apt-get install -y libreoffice',
    win: 'Download from https://www.libreoffice.org/download/download/'
  });
}

// Check Calibre
if (!checkBinary(['ebook-convert', 'ebook-convert.exe'])) {
  missing.push({
    name: 'Calibre',
    mac: 'brew install --cask calibre',
    linux: 'sudo apt-get install -y calibre',
    win: 'Download from https://calibre-ebook.com/download'
  });
}

// Check Ghostscript
const gsNames = isWin ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'];
if (!checkBinary(gsNames)) {
  missing.push({
    name: 'Ghostscript',
    mac: 'brew install ghostscript',
    linux: 'sudo apt-get install -y ghostscript',
    win: 'Download from https://ghostscript.com/releases/gsdnld.html'
  });
}

if (missing.length > 0) {
  console.log('\n⚠️  Warning: The following system dependencies are missing and are required for conversions:');
  missing.forEach((dep) => {
    console.log(`\n•  ${dep.name}`);
    if (os.platform() === 'darwin') {
      console.log(`   Install via: ${dep.mac}`);
    } else if (os.platform() === 'linux') {
      console.log(`   Install via: ${dep.linux}`);
    } else {
      console.log(`   Install via: ${dep.win}`);
    }
  });
  console.log('\n(Note: After manual installation of these tools on Windows, ensure their folder path is added to your environment variables PATH.)');
} else {
  console.log('✅ All system dependencies (LibreOffice, Calibre, Ghostscript) are installed!');
}

console.log('\n==================================================');
console.log('🎉 Setup Complete!');
console.log('==================================================');
console.log('To run the project, open two terminal windows and execute:');
console.log('\n👉 Terminal 1 (Backend):');
console.log('   cd backend && npm run dev');
console.log('\n👉 Terminal 2 (Frontend):');
console.log('   cd frontend && npm run dev');
console.log('==================================================\n');
