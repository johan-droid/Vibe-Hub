import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  SECURITY_REGRESSION_SUITES,
  createAuditFinding,
  createAuditReport,
  validateAuditFinding,
} from '../security/audit-report.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('agentic audit artifact format', () => {
  it('requires proof-oriented fields for every finding', () => {
    const finding = createAuditFinding({
      id: 'SEC-test',
      severity: 'high',
      subsystem: 'sandbox',
      attack_path: 'Prompt-injected code attempts to read a forbidden file.',
      evidence: ['sandbox refused .env'],
      impact: 'Secret exfiltration is blocked.',
      fix_plan: 'Keep the sandbox copy allowlist deny-by-default.',
      tests: ['test/docker-executor.test.js'],
      status: 'fixed',
    });

    expect(validateAuditFinding(finding)).toMatchObject({
      id: 'SEC-test',
      severity: 'high',
      status: 'fixed',
    });
  });

  it('ships the required security regression suite groups', () => {
    expect([...SECURITY_REGRESSION_SUITES]).toEqual([
      'auth-boundary',
      'tool-auth',
      'sandbox',
      'vfs-paths',
      'model-memory',
      'workflow-supply-chain',
      'frontend-xss',
    ]);
  });

  it('validates the tracked audit backlog artifact', async () => {
    const raw = await fs.readFile(path.join(REPO_ROOT, 'docs/security/agentic-audit-backlog.json'), 'utf-8');
    const backlog = JSON.parse(raw);
    const report = createAuditReport(backlog);

    expect(report.threatModel).toBe('multi-tenant-saas');
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every(finding => Array.isArray(finding.tests))).toBe(true);
  });
});

describe('workflow-supply-chain audit automation', () => {
  it('runs without high or critical findings on the current tracked tree', async () => {
    const { stdout } = await execFileAsync('node', ['scripts/selina-security-audit.mjs'], {
      cwd: REPO_ROOT,
      env: { ...process.env, SELINA_SECURITY_AUDIT_FAIL_ON: 'high' },
    });

    expect(stdout).toContain('[selina-security-audit]');
    expect(stdout).not.toContain('[high]');
    expect(stdout).not.toContain('[critical]');
  });

  it('does not track local secret files', async () => {
    const { stdout } = await execFileAsync('git', ['ls-files'], { cwd: REPO_ROOT });
    const trackedSecretFiles = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .filter(file => /\.env($|\.)/.test(file))
      .filter(file => !file.endsWith('.env.example'));

    expect(trackedSecretFiles).toEqual([]);
  });
});
