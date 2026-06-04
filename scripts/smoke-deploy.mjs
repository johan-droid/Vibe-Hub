#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || process.env.API_ORIGIN || process.env.RENDER_EXTERNAL_URL;
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || '8000', 10);

if (!baseUrl) {
  console.error('SMOKE_BASE_URL or API_ORIGIN is required.');
  process.exit(1);
}

function joinUrl(base, path) {
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkJson({ name, path, expectOk = true, validate = () => true }) {
  const url = joinUrl(baseUrl, path);
  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json' },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${name} returned non-JSON response: ${text.slice(0, 200)}`);
  }

  if (expectOk && !response.ok) {
    throw new Error(`${name} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  if (!validate(body, response)) {
    throw new Error(`${name} returned unexpected payload: ${JSON.stringify(body)}`);
  }

  return { name, status: response.status, ok: response.ok, body };
}

const checks = [
  {
    name: 'health',
    path: '/health',
    validate: body => body && body.liveness === true && typeof body.ready === 'boolean',
  },
  {
    name: 'ready',
    path: '/ready',
    validate: body => body && typeof body.ready === 'boolean' && body.checks,
  },
  {
    name: 'auth-status',
    path: '/api/auth/status',
    validate: body => body && body.success === true && body.authenticated === false,
  },
];

try {
  const results = [];
  for (const check of checks) {
    results.push(await checkJson(check));
  }
  console.log(JSON.stringify({ success: true, baseUrl, results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, baseUrl, error: error.message }, null, 2));
  process.exit(1);
}
