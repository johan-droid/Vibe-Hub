import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const patchesDir = path.join(repoRoot, 'patches');

function hasPatchFiles(dir) {
  if (!fs.existsSync(dir)) return false;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && hasPatchFiles(entryPath)) return true;
    if (entry.isFile() && entry.name.endsWith('.patch')) return true;
  }

  return false;
}

if (!hasPatchFiles(patchesDir)) {
  console.log('No patch files found; skipping patch-package.');
  process.exit(0);
}

const binaryName = process.platform === 'win32' ? 'patch-package.cmd' : 'patch-package';
const binaryPath = path.join(repoRoot, 'node_modules', '.bin', binaryName);

if (!fs.existsSync(binaryPath)) {
  console.error('Patch files exist, but patch-package is not installed.');
  process.exit(1);
}

const result = spawnSync(binaryPath, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status ?? 1);
