import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ROLLOUT_ROOT = path.join(SERVER_ROOT, 'scratch', 'rollouts');
const MAX_STRING_LENGTH = 4096;
const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|cookie|jwt|password|secret|session|token)/i;

function sanitizeSegment(value, fallback) {
  const raw = String(value || fallback || 'unknown').trim();
  const cleaned = raw
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.+/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);

  return cleaned || fallback || 'unknown';
}

function resolveInside(rootDir, ...segments) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, ...segments);
  const relative = path.relative(root, target);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Rollout path escaped the configured rollout directory.');
  }

  return target;
}

function limitString(value) {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}\n...[truncated]`;
}

function redactString(value, sensitiveValues = []) {
  let redacted = limitString(value)
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s"',}]+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|cookie|jwt|password|secret|session|token)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi, '$1[redacted]');

  for (const { key, val } of sensitiveValues) {
    if (val && val.length > 5) {
      redacted = redacted.split(val).join(`[REDACTED_${key}]`);
    }
  }
  return redacted;
}

function redactValue(value, sensitiveValues = [], depth = 0) {
  if (depth > 6) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value, sensitiveValues);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redactValue(item, sensitiveValues, depth + 1));

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 100).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactValue(item, sensitiveValues, depth + 1),
      ])
    );
  }

  return String(value);
}

function normalizePlan(plan) {
  if (Array.isArray(plan)) {
    return plan.map((step, index) => `${index + 1}. ${step}`).join('\n');
  }
  return String(plan || '').trim();
}

function renderInitialPlan({ prompt, effortLevel, projectName, runId, sessionId, parentRolloutId, auditMode = 'standard' }) {
  return `# Selina Agent Plan

Run: \`${runId}\`
Session: \`${sessionId || runId}\`
Parent rollout: \`${parentRolloutId || 'root'}\`
Project: \`${projectName}\`
Effort: \`${effortLevel || 'standard'}\`
Audit mode: \`${auditMode}\`

## User Request

${prompt || 'No prompt captured.'}

## Operating Loop

1. Plan the work before editing.
2. Execute scoped tool and file operations.
3. Verify with tests, build, lint, or sandbox checks.
4. Repair failures before marking the run complete.
5. Record implementation notes and final status.
`;
}

function renderStatus({ state, details }) {
  return `# Selina Run Status

State: \`${state}\`
Updated: \`${new Date().toISOString()}\`

${details ? `## Details\n\n${details}\n` : ''}
`;
}

export class RolloutRecorder {
  constructor({
    rootDir = process.env.SELINA_ROLLOUT_DIR || DEFAULT_ROLLOUT_ROOT,
    runId,
    sessionId = null,
    parentRolloutId = null,
    userId = 'anonymous',
    projectName = 'default',
    auditMode = 'standard',
  } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.runId = sanitizeSegment(runId || `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`, 'run');
    this.sessionId = sessionId ? sanitizeSegment(sessionId, 'session') : null;
    this.parentRolloutId = parentRolloutId ? sanitizeSegment(parentRolloutId, 'parent') : null;
    this.userId = sanitizeSegment(userId, 'anonymous');
    this.projectName = sanitizeSegment(projectName, 'default');
    this.auditMode = sanitizeSegment(auditMode, 'standard');
    this.dir = this.sessionId
      ? resolveInside(this.rootDir, this.sessionId, this.runId)
      : resolveInside(this.rootDir, this.userId, this.projectName, this.runId);
    this.eventsFile = path.join(this.dir, 'rollout.jsonl');
    this.planFile = path.join(this.dir, 'plans.md');
    this.implementationFile = path.join(this.dir, 'implement.md');
    this.statusFile = path.join(this.dir, 'status.md');

    this.sensitiveValues = Object.keys(process.env)
      .filter(key => SECRET_KEY_PATTERN.test(key))
      .map(key => ({ key, val: process.env[key] }))
      .filter(item => item.val && item.val.length > 5);
  }

  static async create(metadata = {}) {
    const recorder = new RolloutRecorder(metadata);
    await recorder.initialize(metadata);
    return recorder;
  }

  async initialize(metadata = {}) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.planFile, renderInitialPlan({
      ...metadata,
      projectName: this.projectName,
      runId: this.runId,
      sessionId: this.sessionId,
      parentRolloutId: this.parentRolloutId,
      auditMode: this.auditMode,
    }), 'utf-8');
    await fs.writeFile(this.implementationFile, `# Selina Implementation Log\n\nRun: \`${this.runId}\`\nSession: \`${this.sessionId || this.runId}\`\nParent rollout: \`${this.parentRolloutId || 'root'}\`\n\n`, 'utf-8');
    await fs.writeFile(this.statusFile, renderStatus({ state: 'planning', details: 'Rollout initialized.' }), 'utf-8');
    await this.record('rollout_created', metadata);
  }

  async record(type, payload = {}) {
    await fs.mkdir(this.dir, { recursive: true });
    const event = {
      ts: new Date().toISOString(),
      runId: this.runId,
      sessionId: this.sessionId || this.runId,
      parent_rollout_id: this.parentRolloutId,
      auditMode: this.auditMode,
      type: sanitizeSegment(type, 'event'),
      payload: redactValue(payload, this.sensitiveValues),
    };
    await fs.appendFile(this.eventsFile, `${JSON.stringify(event)}\n`, 'utf-8');
    return event;
  }

  async writePlan(plan) {
    const content = `# Selina Agent Plan\n\n${normalizePlan(plan)}\n`;
    await fs.writeFile(this.planFile, content, 'utf-8');
    await this.record('plan_updated', { plan });
  }

  async updateStatus(state, details = '') {
    await fs.writeFile(this.statusFile, renderStatus({ state, details }), 'utf-8');
    await this.record('status_updated', { state, details });
  }

  async appendImplementation(note, metadata = {}) {
    const entry = `## ${new Date().toISOString()}\n\n${String(note || '').trim() || 'No note provided.'}\n\n`;
    await fs.appendFile(this.implementationFile, entry, 'utf-8');
    await this.record('implementation_note_added', metadata);
  }

  getPaths() {
    return {
      runId: this.runId,
      sessionId: this.sessionId || this.runId,
      parentRolloutId: this.parentRolloutId,
      auditMode: this.auditMode,
      directory: this.dir,
      events: this.eventsFile,
      plan: this.planFile,
      implementation: this.implementationFile,
      status: this.statusFile,
    };
  }
}

export function createTempRolloutRoot(prefix = 'selina-rollout-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export default RolloutRecorder;
