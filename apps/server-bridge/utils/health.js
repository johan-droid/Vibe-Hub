import { execFile } from 'child_process';
import { promisify } from 'util';
import pool from '../db.js';

const execFileAsync = promisify(execFile);
const HEALTH_TIMEOUT_MS = Number.parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '2500', 10);
const extraChecks = new Map();

function withTimeout(promise, label) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out`)), HEALTH_TIMEOUT_MS);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

export async function checkDatabase() {
  const started = Date.now();
  try {
    await withTimeout(pool.query('SELECT 1'), 'database');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err.message };
  }
}

export async function checkDocker() {
  const started = Date.now();
  try {
    await withTimeout(execFileAsync('docker', ['info']), 'docker');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err.message };
  }
}

export async function getReadiness() {
  const [database, docker, ...extraResults] = await Promise.all([
    checkDatabase(),
    checkDocker(),
    ...Array.from(extraChecks.entries()).map(async ([name, check]) => {
      const started = Date.now();
      try {
        await withTimeout(check(), name);
        return [name, { ok: true, latencyMs: Date.now() - started }];
      } catch (err) {
        return [name, { ok: false, latencyMs: Date.now() - started, error: err.message }];
      }
    }),
  ]);
  const extras = Object.fromEntries(extraResults);
  const ready = database.ok && docker.ok && Object.values(extras).every(check => check.ok);

  return {
    status: ready ? 'active' : 'degraded',
    ready,
    version: '4.1.0',
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed,
    checks: { database, docker, ...extras },
  };
}

export function registerReadinessCheck(name, check) {
  extraChecks.set(name, check);
}

export async function requireReadiness(_req, res, next) {
  const readiness = await getReadiness();
  if (!readiness.ready) {
    return res.status(503).json({
      success: false,
      error: 'Backend dependencies are not ready.',
      readiness,
    });
  }
  next();
}
