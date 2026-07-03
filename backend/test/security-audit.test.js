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
const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

  it('builds a valid audit report from a trimmed-repo backlog fixture', async () => {
    const report = createAuditReport({
      findings: [{
        id: 'SEC-trimmed-001',
        severity: 'medium',
        subsystem: 'repo-shape',
        attack_path: 'Missing workspace guards could let secrets or junk files drift back into the repo.',
        evidence: ['render.yaml keeps edge and control-plane protections configured'],
        impact: 'Production drift could weaken deployment safety.',
        fix_plan: 'Keep root deployment controls and tracked-file checks under test.',
        tests: ['backend/test/security-audit.test.js'],
        status: 'fixed',
      }],
    });

    expect(report.threatModel).toBe('multi-tenant-saas');
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every(finding => Array.isArray(finding.tests))).toBe(true);
  });
});

describe('workflow-supply-chain audit automation', () => {
  it('keeps deployment guardrails declared in the tracked root config', async () => {
    const renderYaml = await fs.readFile(path.join(REPO_ROOT, 'render.yaml'), 'utf-8');

    expect(renderYaml).toContain('EDGE_PROTECTION_REQUIRED');
    expect(renderYaml).toContain('EDGE_PROVIDER');
    expect(renderYaml).toContain('ALLOW_PUBLIC_CONTROL_PLANE');
    expect(renderYaml).toContain('CONTROL_PLANE_INTERNAL_TOKEN');
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
