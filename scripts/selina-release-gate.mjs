import { spawnSync } from 'child_process';

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const node = isWindows ? 'node.exe' : 'node';
const docker = isWindows ? 'docker.exe' : 'docker';

function run(label, command, args, options = {}) {
  console.log(`\n[release-gate] ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function dockerAvailable() {
  const result = spawnSync(docker, ['version', '--format', '{{.Server.Version}}'], {
    stdio: 'pipe',
    shell: false,
    encoding: 'utf-8',
  });
  return result.status === 0;
}

try {
  run('Production sanitation', npm, ['run', 'sanitize']);
  run('UI build', npm, ['run', 'build', '--workspace=apps/user-interface']);
  run('UI lint', npm, ['run', 'lint', '--workspace=apps/user-interface']);
  run('UI unit tests', npm, ['run', 'test:unit', '--workspace=apps/user-interface']);
  run('Playwright and axe smoke', npm, ['run', 'test:e2e', '--workspace=apps/user-interface']);
  run('Backend tests', npm, ['test', '--workspace=apps/server-bridge']);
  run('Backend syntax checks', node, ['--check', 'apps/server-bridge/index.js']);
  run('Production dependency audit', npm, ['audit', '--omit=dev']);

  if (!dockerAvailable()) {
    throw new Error('Docker is unavailable. Start Docker Desktop before release.');
  }

  run('Local Docker sandbox smoke', docker, ['run', '--rm', '--network', 'none', 'alpine:3.20', 'sh', '-c', 'echo selina-sandbox-ok']);
  console.log('\n[release-gate] All checks passed.');
} catch (error) {
  console.error(`\n[release-gate] ${error.message}`);
  process.exit(1);
}
