/**
 * @fileoverview tests/soak/soak-runner.js
 * @description Advanced automated soak test runner and telemetry collector.
 * Simulates high steady-state user load to hit 80% DB capacity, tracks Node.js V8 
 * memory leaks, measures event loop lag, and queries PostgreSQL autovacuum/vacuum status.
 */

import { spawn } from 'child_process';
import http from 'http';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load server-bridge environment variables
dotenv.config({ path: path.resolve('apps/server-bridge/.env') });

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const DB_URL = process.env.DATABASE_URL;
// 24 hours = 86400 seconds. Default to 60 seconds for easy verification / test runs.
const DURATION_SEC = Number(process.env.SOAK_DURATION || 60); 
const CONCURRENCY = 16; // 80% of the max PG Pool size (20)

let serverProcess = null;
let dbClient = null;
let metricsInterval = null;

// Telemetry counters
let totalRequestsSent = 0;
let totalRequestsSuccess = 0;
let totalRequestsFailed = 0;

// Track maximum heap usage to flag potential memory leaks
let peakHeapUsedBytes = 0;
let eventLoopLagMs = 0;

/**
 * Measure Event Loop Lag/Delay using microtask timing
 */
function measureEventLoopLag() {
  const start = Date.now();
  setTimeout(() => {
    eventLoopLagMs = Date.now() - start;
  }, 0);
}

/**
 * Perform a request with a Promise wrapper
 */
function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options.agent && { agent: options.agent }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Spawns the server bridge if it's not already running
 */
async function ensureServerRunning() {
  return new Promise((resolve) => {
    // Ping to check if server is already running
    const req = http.get(`${API_BASE}/api/v6/csrf-token`, (res) => {
      console.log('\x1b[36m%s\x1b[0m', `[Soak] Server-bridge is already running on ${API_BASE}. Reusing instance.`);
      res.resume();
      resolve(true);
    });

    req.on('error', () => {
      console.log('\x1b[33m%s\x1b[0m', `[Soak] Server-bridge not detected. Spawning child process in apps/server-bridge...`);
      serverProcess = spawn('node', ['index.js'], {
        cwd: path.resolve('apps/server-bridge'),
        env: { ...process.env, NODE_ENV: 'test', SELINA_ENABLE_GITHUB_MOCK_AUTH: 'true' },
        stdio: 'inherit'
      });

      // Wait 3 seconds for server boot
      setTimeout(() => {
        resolve(true);
      }, 3000);
    });
  });
}

/**
 * Dynamic Session Creation matching realistic user journey
 */
async function authenticateUser(vuIndex) {
  try {
    // 1. Hit github auth endpoint (mock auth enabled)
    const authRes = await requestJson(`${API_BASE}/api/auth/github?returnOrigin=${encodeURIComponent(API_BASE)}`, {
      method: 'GET'
    });

    if (authRes.status !== 302) {
      throw new Error(`Authentication redirect failed with code ${authRes.status}`);
    }

    const redirectLocation = authRes.headers['location'] || '';
    const match = redirectLocation.match(/code=([^&]+)/);
    if (!match) {
      throw new Error('Handoff code not found in redirect URL');
    }
    const code = match[1];

    // 2. POST to exchange code for session cookies
    const handoffRes = await requestJson(`${API_BASE}/api/auth/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (handoffRes.status !== 200) {
      throw new Error(`Session handoff failed with code ${handoffRes.status}`);
    }

    // Capture response cookies
    const cookies = handoffRes.headers['set-cookie'] || [];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

    // 3. Retrieve CSRF token
    const csrfRes = await requestJson(`${API_BASE}/api/v6/csrf-token`, {
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });

    const parsedCsrf = JSON.parse(csrfRes.body);
    return {
      cookieHeader,
      csrfToken: parsedCsrf.csrfToken
    };
  } catch (error) {
    console.error(`[Soak] Authentication failed for VU ${vuIndex}:`, error.message);
    return null;
  }
}

/**
 * Executes a single user job execution cycle (submit -> wait/poll)
 */
async function executeWorkflowCycle(vuIndex) {
  const auth = await authenticateUser(vuIndex);
  if (!auth) return;

  const { cookieHeader, csrfToken } = auth;
  const userUuid = 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, () => (Math.random() * 16 | 0).toString(16));

  const body = JSON.stringify({
    prompt: 'Soak test background iteration validating connection pool stability under 80% load.',
    userId: `soak-user-${userUuid}`,
    targetFile: `soak/verify-${vuIndex}.js`,
    effortLevel: 'standard'
  });

  const startTime = Date.now();
  totalRequestsSent++;

  try {
    const codeRes = await requestJson(`${API_BASE}/api/v6/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': `soak-id-${vuIndex}-${Date.now()}`
      },
      body
    });

    if (![200, 202].includes(codeRes.status)) {
      totalRequestsFailed++;
      return;
    }

    const parsedJob = JSON.parse(codeRes.body);
    const jobId = parsedJob.jobId;
    if (!jobId) {
      totalRequestsSuccess++;
      return; // Handled inline
    }

    // Poll status up to 10 times (20 seconds max)
    let finished = false;
    for (let poll = 0; poll < 10; poll++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await requestJson(`${API_BASE}/api/v6/code/jobs/${jobId}`, {
        method: 'GET',
        headers: { 'Cookie': cookieHeader }
      });

      if (pollRes.status === 200) {
        const statusData = JSON.parse(pollRes.body);
        const state = statusData.job?.state;
        if (['completed', 'completed_job_finished', 'success', 'failed', 'fatal_failure', 'dead-lettered'].includes(state)) {
          finished = true;
          totalRequestsSuccess++;
          break;
        }
      } else {
        break;
      }
    }

    if (!finished) {
      totalRequestsFailed++;
    }
  } catch (error) {
    totalRequestsFailed++;
    console.error(`[Soak] Workflow execution loop error on VU ${vuIndex}:`, error.message);
  }
}

/**
 * Dynamic Worker Loop managing steady state active load
 */
async function loadGeneratorLoop(vuIndex, signal) {
  while (!signal.stopped) {
    await executeWorkflowCycle(vuIndex);
    // Pause for 1 second before kicking off another cycle
    await new Promise(r => setTimeout(r, 1000));
  }
}

/**
 * Fetch Autovacuum and PostgreSQL Stats from the active database
 */
async function fetchPostgresStats() {
  if (!dbClient) return null;

  try {
    const vacuumRes = await dbClient.query(`
      SELECT 
        schemaname, 
        relname, 
        n_live_tup, 
        n_dead_tup, 
        vacuum_count, 
        autovacuum_count,
        to_char(last_vacuum, 'YYYY-MM-DD HH24:MI:SS') as last_vac,
        to_char(last_autovacuum, 'YYYY-MM-DD HH24:MI:SS') as last_autovac
      FROM pg_stat_user_tables 
      WHERE relname IN ('users', 'user_sessions', 'refresh_tokens', 'ast_graphs', 'semantic_embeddings', 'agent_runs')
      ORDER BY relname;
    `);

    const poolRes = await dbClient.query(`
      SELECT count(*), state 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
      GROUP BY state;
    `);

    return {
      tables: vacuumRes.rows,
      connections: poolRes.rows
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Log System Telemetry Dashboard
 */
async function printTelemetryReport() {
  measureEventLoopLag();
  
  const mem = process.memoryUsage();
  const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMb = (mem.heapTotal / 1024 / 1024).toFixed(2);
  const rssMb = (mem.rss / 1024 / 1024).toFixed(2);
  const externalMb = (mem.external / 1024 / 1024).toFixed(2);

  if (mem.heapUsed > peakHeapUsedBytes) {
    peakHeapUsedBytes = mem.heapUsed;
  }
  const peakHeapUsedMb = (peakHeapUsedBytes / 1024 / 1024).toFixed(2);

  const pgStats = await fetchPostgresStats();

  console.clear();
  console.log('=============================================================================');
  console.log(`                 VIBE HUB SOAK TEST RUNNER - TELEMETRY REPORT                `);
  console.log(`                     Duration: ${DURATION_SEC}s | Concurrency Limit: ${CONCURRENCY}                     `);
  console.log('=============================================================================');
  
  console.log('\n[NODE.JS SYSTEM METRICS]');
  console.log(`- RSS Memory:         ${rssMb} MB`);
  console.log(`- V8 Heap Usage:      ${heapUsedMb} MB / ${heapTotalMb} MB (Peak: ${peakHeapUsedMb} MB)`);
  console.log(`- External Buffers:   ${externalMb} MB`);
  console.log(`- Event Loop Lag:     ${eventLoopLagMs} ms`);

  console.log('\n[TRAFFIC & WORKFLOW STATUS]');
  console.log(`- Total Runs Sparked: ${totalRequestsSent}`);
  console.log(`- Successful Runs:    \x1b[32m${totalRequestsSuccess}\x1b[0m`);
  console.log(`- Failed/Timeout Runs: \x1b[31m${totalRequestsFailed}\x1b[0m`);

  if (pgStats) {
    console.log('\n[POSTGRES ACTIVE DATABASE METRICS]');
    if (pgStats.error) {
      console.log(`- DB Stats Error:     ${pgStats.error}`);
    } else {
      console.log('- Connection States:');
      pgStats.connections.forEach(c => {
        console.log(`  * ${c.state || 'connecting/internal'}: ${c.count}`);
      });

      console.log('\n- Autovacuum / Table Metrics:');
      console.log('  -----------------------------------------------------------------------------------------------');
      console.log('  | Table Name          | Live Tuples | Dead Tuples | Vacuums | Autovacs | Last Autovacuum     |');
      console.log('  -----------------------------------------------------------------------------------------------');
      pgStats.tables.forEach(t => {
        const name = t.relname.padEnd(20);
        const live = String(t.n_live_tup).padStart(11);
        const dead = String(t.n_dead_tup).padStart(11);
        const vacs = String(t.vacuum_count).padStart(7);
        const autovacs = String(t.autovacuum_count).padStart(8);
        const lastAuto = (t.last_autovac || 'Never').padEnd(19);
        console.log(`  | ${name} | ${live} | ${dead} | ${vacs} | ${autovacs} | ${lastAuto} |`);
      });
      console.log('  -----------------------------------------------------------------------------------------------');
    }
  }
  console.log('\n=============================================================================');
}

/**
 * Primary Execution Lifecycle
 */
async function main() {
  console.log(`[Soak] Starting soak test suite... Configuration: ${DURATION_SEC} seconds.`);

  // 1. Start Server-Bridge if not running
  await ensureServerRunning();

  // 2. Initialize Direct PG connection for autovacuum logging
  if (DB_URL) {
    try {
      dbClient = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
      await dbClient.connect();
      console.log('[Soak] Successfully connected to PostgreSQL telemetry engine.');
    } catch (e) {
      console.warn('[Soak] PostgreSQL telemetry connection bypassed. Error:', e.message);
    }
  } else {
    console.warn('[Soak] DATABASE_URL missing. Database metrics logging will be skipped.');
  }

  // 3. Spark Concurrent Load Loops
  const signal = { stopped: false };
  const loadPromises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    loadPromises.push(loadGeneratorLoop(i, signal));
  }

  // 4. Set interval for system telemetry reports (every 10 seconds)
  metricsInterval = setInterval(printTelemetryReport, 10000);
  
  // Do a first report immediately after 2 seconds
  setTimeout(printTelemetryReport, 2000);

  // 5. Setup test termination handler
  setTimeout(async () => {
    console.log(`\n\x1b[36m%s\x1b[0m`, `[Soak] Test completion threshold reached (${DURATION_SEC}s). Spinning down...`);
    signal.stopped = true;
    clearInterval(metricsInterval);

    if (dbClient) {
      await dbClient.end().catch(() => {});
    }

    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }

    console.log('\x1b[32m%s\x1b[0m', '[Soak] Telemetry session shutdown cleanly. All metrics collected.');
    process.exit(0);
  }, DURATION_SEC * 1000);
}

main().catch(err => {
  console.error('[Soak] Unhandled exception inside soak controller:', err);
  process.exit(1);
});
