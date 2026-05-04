import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    code_generation: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 100),
      duration: __ENV.DURATION || '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3001';
const TOKEN = __ENV.JWT || '';
const USER_ID = __ENV.USER_ID || '11111111-1111-4111-8111-111111111111';

export function setup() {
  if (!TOKEN) return { csrfToken: '' };

  const res = http.get(`${API_BASE}/api/v6/csrf-token`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  return {
    csrfToken: res.json('csrfToken') || '',
  };
}

export default function run(data) {
  const idempotencyKey = `k6-${__VU}-${__ITER}`;
  const body = JSON.stringify({
    prompt: 'Create a small pure function for load-test validation.',
    userId: USER_ID,
    targetFile: `load/generated-${__VU}.js`,
    socketId: __ENV.SOCKET_ID || `load-test-${__VU}`,
  });

  const res = http.post(`${API_BASE}/api/v6/code`, body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: TOKEN ? `Bearer ${TOKEN}` : '',
      'X-CSRF-Token': data.csrfToken,
      'Idempotency-Key': idempotencyKey,
    },
  });

  check(res, {
    'accepted, completed, rate-limited, or dependency-gated': response =>
      [200, 202, 429, 503].includes(response.status),
  });

  sleep(1);
}
