import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(currentDirectory, '..');
const rootDirectory = path.resolve(backendDirectory, '..');
const candidates = process.platform === 'win32'
  ? [path.join(rootDirectory, 'venv', 'Scripts', 'python.exe')]
  : [
      path.join(rootDirectory, 'venv', 'bin', 'python3'),
      path.join(rootDirectory, 'venv', 'bin', 'python'),
    ];
const python = candidates.find((candidate) => fs.existsSync(candidate))
  || (process.platform === 'win32' ? 'python' : 'python3');
const testCacheDirectory = path.join(os.tmpdir(), 'archeio-test-cache');
fs.mkdirSync(testCacheDirectory, { recursive: true });

const result = spawnSync(
  python,
  ['-m', 'unittest', 'discover', '-s', 'ocr_pipeline/ocr_test', '-p', 'test_*.py'],
  {
    cwd: backendDirectory,
    stdio: 'inherit',
    env: {
      ...process.env,
      MPLCONFIGDIR: process.env.MPLCONFIGDIR || path.join(testCacheDirectory, 'matplotlib'),
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || testCacheDirectory,
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
    },
  },
);

if (result.error) {
  console.error(`Unable to run OCR tests with ${python}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
