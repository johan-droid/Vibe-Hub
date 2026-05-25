import path from 'path';
import { runParitySuite } from '../apps/server-bridge/evals/parity/runner.js';

function parseArgs(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--mode' && next) {
      options.runMode = next;
      index += 1;
      continue;
    }
    if (arg === '--run-id' && next) {
      options.runId = next;
      index += 1;
      continue;
    }
    if (arg === '--manifest' && next) {
      options.manifestPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (arg === '--artifact-dir' && next) {
      options.artifactDirectory = path.resolve(next);
      index += 1;
      continue;
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));

try {
  const { report, artifactPaths } = await runParitySuite(options);
  console.log(report.summary);
  console.log('');
  console.log(`Artifacts: ${artifactPaths.directory}`);
  console.log(`- report.json: ${artifactPaths.report}`);
  console.log(`- summary.md: ${artifactPaths.summary}`);
  console.log(`- task-results.jsonl: ${artifactPaths.taskResults}`);
  process.exitCode = report.status === 'below parity' ? 1 : 0;
} catch (error) {
  console.error(`Parity evaluation failed: ${error.message}`);
  process.exitCode = 1;
}
