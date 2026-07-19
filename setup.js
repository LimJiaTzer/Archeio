const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const venvDir = path.join(rootDir, 'venv');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const skipModelDownload = process.argv.includes('--skip-model-download')
  || process.env.ARCHEIO_SKIP_MODEL_DOWNLOAD === '1';

function fail(message) {
  console.error(`\nSetup failed: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) {
    console.error(result.error.message);
  }
  return result.status === 0;
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) return null;
  return String(result.stdout || '').trim();
}

function versionAtLeast(version, required) {
  const current = version.split('.').map(Number);
  for (let index = 0; index < required.length; index += 1) {
    const value = current[index] || 0;
    if (value > required[index]) return true;
    if (value < required[index]) return false;
  }
  return true;
}

function supportedNodeVersion(version) {
  const [major, minor] = version.split('.').map(Number);
  return (major === 20 && minor >= 19)
    || (major === 22 && minor >= 12)
    || major > 22;
}

function probePython(command, prefixArgs = []) {
  const output = capture(command, [
    ...prefixArgs,
    '-c',
    'import platform,sys; print(".".join(map(str, sys.version_info[:3])) + "|" + platform.machine())',
  ]);
  if (!output || !output.includes('|')) return null;
  const [version, architecture] = output.split('|');
  return { command, prefixArgs, version, architecture };
}

function findPython() {
  const candidates = [];
  if (process.env.ARCHEIO_PYTHON) {
    candidates.push({ command: process.env.ARCHEIO_PYTHON, prefixArgs: [] });
  }
  if (isWindows) {
    candidates.push(
      { command: 'py', prefixArgs: ['-3'] },
      { command: 'python', prefixArgs: [] },
      { command: 'python3', prefixArgs: [] },
    );
  } else {
    candidates.push(
      { command: 'python3', prefixArgs: [] },
      { command: 'python', prefixArgs: [] },
    );
  }

  for (const candidate of candidates) {
    const python = probePython(candidate.command, candidate.prefixArgs);
    if (python && versionAtLeast(python.version, [3, 10])) return python;
  }
  return null;
}

function installNodeDependencies(directory, label) {
  const hasLockfile = fs.existsSync(path.join(directory, 'package-lock.json'));
  const action = hasLockfile ? 'ci' : 'install';
  console.log(`\nInstalling ${label} dependencies with npm ${action}...`);
  if (!run(npmCommand, [action], { cwd: directory })) {
    fail(`could not install ${label} dependencies.`);
  }
}

function checkBinary(names, extraPaths = []) {
  for (const candidate of extraPaths) {
    if (fs.existsSync(candidate)) return true;
  }
  const locator = isWindows ? 'where.exe' : 'which';
  return names.some((name) => capture(locator, [name]) !== null);
}

function reportSystemDependencies() {
  console.log('\nChecking optional system conversion engines...');
  const missing = [];
  if (!checkBinary(
    ['soffice', 'soffice.exe'],
    process.platform === 'darwin'
      ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice']
      : [],
  )) {
    missing.push({
      name: 'LibreOffice',
      mac: 'brew install --cask libreoffice',
      linux: 'sudo apt-get install -y libreoffice',
      win: 'https://www.libreoffice.org/download/download/',
    });
  }
  if (!checkBinary(
    ['ebook-convert', 'ebook-convert.exe'],
    process.platform === 'darwin'
      ? ['/Applications/calibre.app/Contents/MacOS/ebook-convert']
      : [],
  )) {
    missing.push({
      name: 'Calibre',
      mac: 'brew install --cask calibre',
      linux: 'sudo apt-get install -y calibre',
      win: 'https://calibre-ebook.com/download',
    });
  }
  if (!checkBinary(isWindows ? ['gswin64c', 'gswin32c', 'gs'] : ['gs'])) {
    missing.push({
      name: 'Ghostscript',
      mac: 'brew install ghostscript',
      linux: 'sudo apt-get install -y ghostscript',
      win: 'https://ghostscript.com/releases/gsdnld.html',
    });
  }

  if (!missing.length) {
    console.log('All optional system conversion engines are available.');
    return;
  }
  console.warn('The application is installed, but these non-OCR converters need system software:');
  for (const dependency of missing) {
    const instruction = process.platform === 'darwin'
      ? dependency.mac
      : process.platform === 'linux'
        ? dependency.linux
        : dependency.win;
    console.warn(`  - ${dependency.name}: ${instruction}`);
  }
}

console.log('==================================================');
console.log('Archeio local setup');
console.log('==================================================');

const nodeVersion = process.versions.node;
if (!supportedNodeVersion(nodeVersion)) {
  fail(`Node.js ${nodeVersion} is unsupported. Install Node.js 20.19+ or 22.12+.`);
}
console.log(`Node.js ${nodeVersion} (${process.arch})`);

installNodeDependencies(frontendDir, 'frontend');
installNodeDependencies(backendDir, 'backend');

console.log('\nPreparing the root Python environment...');
const basePython = findPython();
if (!basePython) {
  fail('Python 3.10 or newer was not found. Install Python, then rerun npm run setup.');
}
console.log(`Python ${basePython.version} (${basePython.architecture})`);

const venvPython = isWindows
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python3');
if (!fs.existsSync(venvDir)) {
  console.log(`Creating ${venvDir}...`);
  if (!run(basePython.command, [...basePython.prefixArgs, '-m', 'venv', venvDir])) {
    fail('could not create the root Python virtual environment.');
  }
} else if (!fs.existsSync(venvPython)) {
  fail(`the existing ${venvDir} is incomplete. Remove it and rerun npm run setup.`);
} else {
  console.log('Reusing the existing root venv.');
}

const venvVersion = capture(venvPython, [
  '-c',
  'import sys; print(".".join(map(str, sys.version_info[:3])))',
]);
if (!venvVersion || !versionAtLeast(venvVersion, [3, 10])) {
  fail(`the root venv uses unsupported Python ${venvVersion || 'unknown'}. Recreate it with Python 3.10+.`);
}

console.log('\nUpdating Python packaging tools...');
if (!run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'])) {
  fail('could not update pip, setuptools, and wheel.');
}

const requirements = path.join(backendDir, 'requirements.txt');
console.log('\nInstalling the OCR and conversion Python packages...');
if (!run(venvPython, ['-m', 'pip', 'install', '-r', requirements])) {
  fail('could not install backend/requirements.txt. Check PaddlePaddle support for your OS and Python version.');
}

const bootstrapArgs = skipModelDownload ? ['--verify-only'] : ['--download-models'];
console.log(skipModelDownload
  ? '\nVerifying the OCR installation without downloading model weights...'
  : '\nDownloading and initializing PP-StructureV3 models. This can take several minutes...');
if (!run(venvPython, ['-m', 'ocr_pipeline.bootstrap', ...bootstrapArgs], { cwd: backendDir })) {
  fail('OCR verification/model initialization failed. Review the Paddle output above.');
}

const frontendEnv = path.join(frontendDir, '.env');
if (!fs.existsSync(frontendEnv)) {
  fs.writeFileSync(frontendEnv, 'VITE_API_URL=http://localhost:3001\n');
  console.log('\nCreated frontend/.env.');
}

reportSystemDependencies();

console.log('\n==================================================');
console.log('Setup complete');
console.log('==================================================');
console.log('Backend:  cd backend && npm run dev');
console.log('Frontend: cd frontend && npm run dev');
console.log('App:      http://localhost:5173');
if (skipModelDownload) {
  console.log('OCR model weights will download during the first conversion.');
}
