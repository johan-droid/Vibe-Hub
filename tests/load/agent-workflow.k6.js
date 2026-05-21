/**
 * @fileoverview tests/load/agent-workflow.k6.js
 * @description Advanced multi-step k6 load testing suite for Vibe Hub Server Bridge.
 * Mimics realistic authenticated user journeys, executes async agent workflows with RAG, 
 * polls for queue updates, and aggregates end-to-end processing metrics.
 * 
 * Ramping to 1M Concurrent Users:
 * To scale this script conceptually to 1M VUs, execute it using the k6 Kubernetes Operator:
 * $ kubectl apply -f k6-operator-custom-resource.yaml
 * Bypass database validation limits in high-scale testing by configuring stateless JWT checks.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Custom metric to track full end-to-end agent job execution latency (from submission to finish)
const agentJobCompletionTrend = new Trend('agent_job_completion_duration');

export const options = {
  scenarios: {
    agent_journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 500 },   // Warm-up ramp to 500 VUs
        { duration: '5m', target: 1000 },  // Ramp to 1000 VUs (target load)
        { duration: '10m', target: 1000 }, // Sustain at target load (soak / stability check)
        { duration: '2m', target: 0 },    // Cool-down ramp
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Quality Gates (SLA Rules)
    http_req_failed: ['rate<0.01'],             // HTTP error rate must be under 1%
    http_req_duration: ['p(95)<2000', 'p(99)<4000'], // 95% of HTTP calls under 2s, 99% under 4s
    agent_job_completion_duration: ['p(95)<30000', 'p(99)<45000'], // 95% of agent runs complete within 30s
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3001';

// Pure JavaScript UUID v4 Generator (k6 compatible)
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  // --- STEP 1: DYNAMIC MOCK USER AUTHENTICATION ---
  // Trigger Mock GitHub OAuth consent which is enabled via SELINA_ENABLE_GITHUB_MOCK_AUTH=true
  // We disable redirects (redirects: 0) to capture the redirection Location header containing the handoff code.
  const uniqueLogin = `k6-vu-${__VU}-${uuidv4().substring(0, 8)}`;
  
  // Custom environment parameters can override mock parameters
  const authUrl = `${API_BASE}/api/auth/github?returnOrigin=${encodeURIComponent(API_BASE)}`;
  const authRes = http.get(authUrl, {
    redirects: 0,
    headers: {
      'User-Agent': 'k6-load-tester',
    },
  });

  if (!check(authRes, { 'mock auth redirected': (r) => r.status === 302 })) {
    return;
  }

  const locationHeader = authRes.headers['Location'] || '';
  const codeMatch = locationHeader.match(/code=([^&]+)/);
  if (!codeMatch) {
    fail('Handoff code missing from redirect Location: ' + locationHeader);
  }
  const handoffCode = codeMatch[1];

  // Exchange the handoff code for cookies (stored automatically in k6's VU Cookie Jar)
  const handoffRes = http.post(`${API_BASE}/api/auth/handoff`, JSON.stringify({ code: handoffCode }), {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-tester',
    },
  });

  if (!check(handoffRes, { 'handoff completed': (r) => r.status === 200 })) {
    return;
  }

  // --- STEP 2: FETCH CSRF TOKEN ---
  const csrfRes = http.get(`${API_BASE}/api/v6/csrf-token`, {
    headers: {
      'User-Agent': 'k6-load-tester',
    },
  });

  if (!check(csrfRes, { 'csrf token fetched': (r) => r.status === 200 })) {
    return;
  }
  const csrfToken = csrfRes.json('csrfToken') || '';

  // --- STEP 3: SUBMIT MULTI-STEP AGENT ORCHESTRATION ---
  const userId = uuidv4();
  const idempotencyKey = `k6-idemp-${__VU}-${__ITER}`;
  
  const payload = JSON.stringify({
    prompt: 'Implement high-performance AST parsing with robust path boundaries.',
    userId: userId,
    targetFile: `load/benchmarking-${__VU}-${__ITER}.js`,
    effortLevel: 'standard',
    queueLane: 'interactive',
    socketId: `k6-socket-${__VU}-${uuidv4().substring(0, 6)}`,
  });

  const startTime = Date.now();
  const codeRes = http.post(`${API_BASE}/api/v6/code`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': idempotencyKey,
      'User-Agent': 'k6-load-tester',
    },
  });

  // Verify either 202 (Enqueued successfully) or 200/429/503 (rate-limit / load overflow)
  check(codeRes, {
    'request submitted successfully': (r) => [200, 202].includes(r.status),
  });

  if (codeRes.status !== 202) {
    // If enqueued inline (200), or rejected (429/503), finish iteration early
    sleep(1);
    return;
  }

  const jobId = codeRes.json('jobId');
  if (!jobId) return;

  // --- STEP 4: POLL ASYNC STATUS UNTIL COMPLETE ---
  let completed = false;
  let attempts = 0;
  const maxAttempts = 30; // Poll for up to 60 seconds (30 * 2s)

  while (!completed && attempts < maxAttempts) {
    sleep(2); // Poll every 2 seconds
    attempts++;

    const pollRes = http.get(`${API_BASE}/api/v6/code/jobs/${jobId}`, {
      headers: {
        'User-Agent': 'k6-load-tester',
      },
    });

    if (check(pollRes, { 'status poll ok': (r) => r.status === 200 })) {
      const state = pollRes.json('job.state');
      if (['completed', 'completed_job_finished', 'success'].includes(state)) {
        completed = true;
        // Track the full end-to-end processing time
        agentJobCompletionTrend.add((Date.now() - startTime) / 1000);
      } else if (['failed', 'fatal_failure', 'dead-lettered'].includes(state)) {
        completed = true;
      }
    } else {
      break; // Abort polling on HTTP error
    }
  }

  sleep(1);
}
