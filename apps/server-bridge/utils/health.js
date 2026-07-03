import { execFile } from 'child_process';
import { promisify } from 'util';
import pool from '../db.js';
import { SELINA_BRAND } from '../config/brand.js';

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

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function selectedSandboxProvider() {
  return String(process.env.SELINA_SANDBOX_PROVIDER || 'disabled').trim().toLowerCase();
}

function isDockerSandboxRequired() {
  const provider = selectedSandboxProvider();
  return boolEnv('SELINA_SANDBOX_REQUIRE_DOCKER')
    || boolEnv('SELINA_SANDBOX_REQUIRE_MICROVM')
    || provider === 'docker-local'
    || provider === 'docker';
}

function healthCheckStatus(check) {
  if (check.required === false) return true;
  return check.ok;
}

export async function checkDatabase() {
  const started = Date.now();
  try {
    await withTimeout(pool.query('SELECT 1'), 'database');
    return { ok: true, required: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, required: true, latencyMs: Date.now() - started, error: err.message };
  }
}

export async function checkDocker() {
  const started = Date.now();
  const required = isDockerSandboxRequired();
  const provider = selectedSandboxProvider();

  if (!required) {
    return {
      ok: true,
      required: false,
      skipped: true,
      provider,
      latencyMs: Date.now() - started,
      reason: 'Docker sandbox is not required for this runtime profile.',
    };
  }

  try {
    await withTimeout(execFileAsync('docker', ['info']), 'docker');
    return { ok: true, required, provider, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, required, provider, latencyMs: Date.now() - started, error: err.message };
  }
}

export async function checkRedis(redisClient = null) {
  const started = Date.now();
  const required = boolEnv('REDIS_REQUIRED', false);

  if (!process.env.REDIS_URL) {
    return {
      ok: !required,
      required,
      skipped: true,
      latencyMs: Date.now() - started,
      reason: required ? 'REDIS_REQUIRED=true but REDIS_URL is not configured.' : 'Redis is disabled; single-process coordination is active.',
    };
  }

  if (!redisClient) {
    return {
      ok: false,
      required: true,
      latencyMs: Date.now() - started,
      error: 'REDIS_URL is configured but no Redis client was registered for readiness.',
    };
  }

  try {
    await withTimeout(redisClient.ping(), 'redis');
    return { ok: true, required: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, required: true, latencyMs: Date.now() - started, error: err.message };
  }
}

export async function getReadiness({ redisClient = null } = {}) {
  const [database, docker, redis, ...extraResults] = await Promise.all([
    checkDatabase(),
    checkDocker(),
    checkRedis(redisClient),
    ...Array.from(extraChecks.entries()).map(async ([name, check]) => {
      const started = Date.now();
      try {
        const result = await withTimeout(check(), name);
        return [name, {
          ok: result?.ok !== false,
          required: result?.required !== false,
          latencyMs: Date.now() - started,
          ...(result && typeof result === 'object' ? result : {}),
        }];
      } catch (err) {
        return [name, { ok: false, required: true, latencyMs: Date.now() - started, error: err.message }];
      }
    }),
  ]);
  const extras = Object.fromEntries(extraResults);
  const checks = { database, redis, sandbox: docker, ...extras };
  const ready = Object.values(checks).every(healthCheckStatus);

  return {
    status: ready ? 'active' : 'degraded',
    ready,
    brand: SELINA_BRAND,
    version: SELINA_BRAND.version,
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed,
    checks,
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
