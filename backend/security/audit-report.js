export const AUDIT_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low', 'info']);

export const AUDIT_STATUSES = Object.freeze(['open', 'fixed', 'accepted_risk', 'false_positive']);

export const SECURITY_REGRESSION_SUITES = Object.freeze([
  'auth-boundary',
  'tool-auth',
  'sandbox',
  'vfs-paths',
  'model-memory',
  'workflow-supply-chain',
  'frontend-xss',
]);

const REQUIRED_FINDING_FIELDS = Object.freeze([
  'id',
  'severity',
  'subsystem',
  'attack_path',
  'evidence',
  'impact',
  'fix_plan',
  'tests',
  'status',
]);

export function createAuditFinding(fields = {}) {
  return validateAuditFinding({
    id: fields.id,
    severity: fields.severity || 'medium',
    subsystem: fields.subsystem,
    attack_path: fields.attack_path,
    evidence: Array.isArray(fields.evidence) ? fields.evidence : [fields.evidence].filter(Boolean),
    impact: fields.impact,
    fix_plan: fields.fix_plan,
    tests: Array.isArray(fields.tests) ? fields.tests : [fields.tests].filter(Boolean),
    status: fields.status || 'open',
  });
}

export function validateAuditFinding(finding = {}) {
  const missing = REQUIRED_FINDING_FIELDS.filter(field => finding[field] === undefined || finding[field] === null);
  if (missing.length > 0) {
    throw new Error(`Audit finding is missing required fields: ${missing.join(', ')}`);
  }

  if (!AUDIT_SEVERITIES.includes(finding.severity)) {
    throw new Error(`Invalid audit finding severity: ${finding.severity}`);
  }

  if (!AUDIT_STATUSES.includes(finding.status)) {
    throw new Error(`Invalid audit finding status: ${finding.status}`);
  }

  if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) {
    throw new Error('Audit finding evidence must be a non-empty array');
  }

  if (!Array.isArray(finding.tests)) {
    throw new Error('Audit finding tests must be an array');
  }

  return {
    ...finding,
    evidence: finding.evidence.map(String),
    tests: finding.tests.map(String),
  };
}

export function createAuditReport({
  target = 'vibe-hub',
  threatModel = 'multi-tenant-saas',
  generatedAt = new Date().toISOString(),
  findings = [],
} = {}) {
  const normalizedFindings = findings.map(createAuditFinding);
  const counts = Object.fromEntries(AUDIT_SEVERITIES.map(severity => [
    severity,
    normalizedFindings.filter(finding => finding.severity === severity).length,
  ]));

  return {
    target,
    threatModel,
    generatedAt,
    regressionSuites: [...SECURITY_REGRESSION_SUITES],
    counts,
    findings: normalizedFindings,
  };
}
