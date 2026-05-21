import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createAuditFinding, createAuditReport } from '../apps/server-bridge/security/audit-report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FAIL_ON = process.env.SELINA_SECURITY_AUDIT_FAIL_ON || 'high';
const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

const ALLOWED_LIFECYCLE_SCRIPTS = {
  postinstall: ['patch-package', 'node scripts/run-patch-package.mjs'],
};

const TEXT_SCAN_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.md', '.yml', '.yaml', '.sh',
]);

const TEXT_SCAN_EXCLUDED = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)node_modules\//,
  /(^|\/)test\//,
  /(^|\/)tests\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
];

function gitTrackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr || result.status}`);
  }

  return result.stdout.split('\0').filter(Boolean).map(file => file.replace(/\\/g, '/'));
}

function addFinding(findings, fields) {
  findings.push(createAuditFinding(fields));
}

function isSecretPath(file) {
  const base = path.basename(file).toLowerCase();
  if (base === '.env.example' || base.endsWith('.env.example')) return false;
  return (
    base === '.env' ||
    base.startsWith('.env.') ||
    /\.(pem|key|p12|pfx)$/i.test(file) ||
    /(^|\/)(id_rsa|id_ed25519|credentials|secret|secrets)(\/|$)/i.test(file)
  );
}

function scanTrackedSecretPaths(files, findings) {
  for (const file of files) {
    if (!isSecretPath(file)) continue;
    addFinding(findings, {
      id: `secret-tracked:${file}`,
      severity: 'critical',
      subsystem: 'workflow-supply-chain',
      attack_path: 'A secret-like file is tracked by Git and can leak through clones, CI logs, deploy artifacts, or prompt context.',
      evidence: [`Tracked file: ${file}`],
      impact: 'Credential disclosure and cross-tenant compromise risk.',
      fix_plan: 'Remove the file from Git history/index, rotate any exposed secret, and keep only sanitized .env.example templates.',
      tests: ['scripts/selina-security-audit.mjs'],
      status: 'open',
    });
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf-8'));
}

function scanLifecycleScripts(files, findings) {
  const packageFiles = files
    .filter(file => file.endsWith('package.json'))
    .filter(file => !file.includes('/node_modules/'));
  for (const file of packageFiles) {
    const scripts = readJson(file).scripts || {};
    for (const [name, command] of Object.entries(scripts)) {
      if (!/^(preinstall|install|postinstall|prepare)$/i.test(name)) continue;
      const allowed = ALLOWED_LIFECYCLE_SCRIPTS[name.toLowerCase()];
      if (allowed && allowed.includes(command)) continue;
      addFinding(findings, {
        id: `lifecycle-script:${file}:${name}`,
        severity: 'high',
        subsystem: 'workflow-supply-chain',
        attack_path: 'Package lifecycle scripts execute during dependency install and can run before normal review gates.',
        evidence: [`${file} scripts.${name} = ${command}`],
        impact: 'Supply-chain backdoor or CI/developer workstation command execution.',
        fix_plan: 'Remove the lifecycle script or document and allowlist the exact benign command in the audit script.',
        tests: ['scripts/selina-security-audit.mjs'],
        status: 'open',
      });
    }
  }
}

function scanWorkflowPrivileges(files, findings) {
  for (const file of files.filter(item => item.startsWith('.github/workflows/') && /\.ya?ml$/i.test(item))) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    if (/pull_request_target\s*:/i.test(text)) {
      addFinding(findings, {
        id: `workflow-pr-target:${file}`,
        severity: 'high',
        subsystem: 'workflow-supply-chain',
        attack_path: 'pull_request_target workflows can run attacker-controlled changes with elevated repository privileges.',
        evidence: [`${file} contains pull_request_target`],
        impact: 'Repository secret or write-token exposure through malicious pull requests.',
        fix_plan: 'Use pull_request with read-only permissions or isolate privileged jobs from untrusted code checkout.',
        tests: ['scripts/selina-security-audit.mjs'],
        status: 'open',
      });
    }
    if (/permissions\s*:\s*write-all/i.test(text) || /contents\s*:\s*write/i.test(text)) {
      addFinding(findings, {
        id: `workflow-write-permission:${file}`,
        severity: 'medium',
        subsystem: 'workflow-supply-chain',
        attack_path: 'Over-broad workflow write permissions increase blast radius if a job is compromised.',
        evidence: [`${file} requests write-level repository permissions`],
        impact: 'Compromised CI job may alter repository contents or metadata.',
        fix_plan: 'Reduce permissions to the minimum per job and separate deploy hooks from untrusted PR jobs.',
        tests: ['scripts/selina-security-audit.mjs'],
        status: 'open',
      });
    }
  }
}

function shouldScanText(file) {
  if (!TEXT_SCAN_EXTENSIONS.has(path.extname(file))) return false;
  return !TEXT_SCAN_EXCLUDED.some(pattern => pattern.test(file));
}

function scanBackdoorPatterns(files, findings) {
  const checks = [
    {
      id: 'dynamic-eval',
      severity: 'high',
      pattern: /\b(eval\s*\(|new\s+Function\s*\()/,
      message: 'Dynamic code evaluation is present in production-tracked source.',
      impact: 'Prompt or user-controlled input may become arbitrary code execution.',
      fix: 'Replace dynamic evaluation with a parser or explicit dispatch table.',
    },
    {
      id: 'private-key-material',
      severity: 'critical',
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/,
      message: 'Private key material appears in a tracked text file.',
      impact: 'Credential disclosure and infrastructure compromise.',
      fix: 'Remove the key, rotate it, and keep only placeholders in examples.',
    },
    {
      id: 'unsafe-vfs-prefix-check',
      severity: 'high',
      pattern: /startsWith\s*\(\s*this\.root\s*\)/,
      message: 'Unsafe root prefix path check is present.',
      impact: 'Path traversal may escape similarly prefixed directories.',
      fix: 'Use path.relative boundary checks and realpath/symlink validation.',
    },
    {
      id: 'workspace-docker-mount',
      severity: 'high',
      pattern: /workspacePath[\s\S]{0,180}:\/workspace:ro/,
      message: 'Docker sandbox appears to mount the primary workspace.',
      impact: 'AI-generated code may read source secrets or repository metadata.',
      fix: 'Copy only requested non-secret files into an isolated temporary sandbox.',
    },
  ];

  for (const file of files.filter(shouldScanText)) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    for (const check of checks) {
      if (!check.pattern.test(text)) continue;
      addFinding(findings, {
        id: `${check.id}:${file}`,
        severity: check.severity,
        subsystem: check.id === 'private-key-material' ? 'workflow-supply-chain' : 'tool-auth',
        attack_path: check.message,
        evidence: [`Matched ${check.id} in ${file}`],
        impact: check.impact,
        fix_plan: check.fix,
        tests: ['scripts/selina-security-audit.mjs'],
        status: 'open',
      });
    }
  }
}

function scanAgentArchitecture(files, findings) {
  const brainSystemPath = 'apps/server-bridge/orchestrator/brain-system.js';
  if (!fs.existsSync(path.join(ROOT, brainSystemPath))) {
    addFinding(findings, {
      id: 'agent-brain-system-missing',
      severity: 'high',
      subsystem: 'model-memory',
      attack_path: 'Agent stages exist as disconnected components without an auditable token-governor, triage, static-analysis, compression, sandbox, validator, and sync-node route.',
      evidence: [`Missing ${brainSystemPath}`],
      impact: 'Worker agents can bypass safety gates or regress into stale model APIs during future orchestration changes.',
      fix_plan: 'Keep a single BrainSystemOrchestrator entrypoint with regression tests for stage order and failure fallback.',
      tests: ['apps/server-bridge/test/brain-system.test.js'],
      status: 'open',
    });
  }

  const staleRequestModelFiles = files
    .filter(file => file.startsWith('apps/server-bridge/orchestrator/'))
    .filter(file => file.endsWith('.js'))
    .filter(file => file !== 'apps/server-bridge/orchestrator/token-governor.js')
    .filter(file => fs.readFileSync(path.join(ROOT, file), 'utf-8').includes('.requestModel('));

  for (const file of staleRequestModelFiles) {
    addFinding(findings, {
      id: `stale-token-governor-api:${file}`,
      severity: 'high',
      subsystem: 'model-memory',
      attack_path: 'Agent worker still calls the legacy TokenGovernor.requestModel shim instead of routing compute through getCompute with the execution callback.',
      evidence: [`${file} contains .requestModel(`],
      impact: 'LLM compute routing can crash or skip provider-specific JSON-mode and prompt-caching controls.',
      fix_plan: 'Use governor.getCompute(complexity, role, apiCallFn) directly at every worker call site.',
      tests: ['apps/server-bridge/test/brain-system.test.js', 'apps/server-bridge/test/token-governor.test.js'],
      status: 'open',
    });
  }
}

function renderReport(report) {
  console.log(`[selina-security-audit] target=${report.target} threatModel=${report.threatModel}`);
  console.log(`[selina-security-audit] findings=${report.findings.length} counts=${JSON.stringify(report.counts)}`);
  for (const finding of report.findings) {
    console.log(`[${finding.severity}] ${finding.id} (${finding.subsystem})`);
    console.log(`  ${finding.attack_path}`);
    console.log(`  Evidence: ${finding.evidence.join('; ')}`);
  }
}

const files = gitTrackedFiles();
const findings = [];

scanTrackedSecretPaths(files, findings);
scanLifecycleScripts(files, findings);
scanWorkflowPrivileges(files, findings);
scanBackdoorPatterns(files, findings);
scanAgentArchitecture(files, findings);

const report = createAuditReport({ findings });
renderReport(report);

const failRank = SEVERITY_RANK[FAIL_ON] ?? SEVERITY_RANK.high;
const blocking = report.findings.filter(finding => SEVERITY_RANK[finding.severity] >= failRank);
if (blocking.length > 0) {
  console.error(`[selina-security-audit] Blocking findings at or above ${FAIL_ON}: ${blocking.length}`);
  process.exit(1);
}
