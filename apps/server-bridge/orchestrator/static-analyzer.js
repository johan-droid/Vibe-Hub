import { execFile } from 'child_process';
import path from 'path';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export async function runPreFlight(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return { errors: false };
  }

  let safeFilePaths;
  try {
    safeFilePaths = filePaths.map(normalizeAnalyzerPath);
  } catch (error) {
    return { errors: true, summary: error.message };
  }

  try {
    const { stdout } = await execFileAsync(npxBin(), [
      'eslint',
      '--no-eslintrc',
      '--plugin',
      'react',
      '--rule',
      'no-undef: error',
      ...safeFilePaths,
    ], {
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return { errors: false, output: stdout };
  } catch (error) {
    // ESLint returns non-zero exit code if there are errors
    return { errors: true, summary: error.stdout || error.message };
  }
}

export function normalizeAnalyzerPath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Static analysis target must be a non-empty relative path.');
  }

  const normalized = path.normalize(filePath.trim());
  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  if (
    path.isAbsolute(normalized) ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`) ||
    parts.includes('..')
  ) {
    throw new Error(`Static analysis target escapes workspace: ${filePath}`);
  }

  return parts.join('/');
}

function npxBin() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}
