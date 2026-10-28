import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, getAuthToken } from './helpers/auth.js';

const initialCreatedCounter = new Counter('first_created_jobs');
const deduplicatedOrConflictCounter = new Counter('deduplicated_or_conflict_responses');

export const options = {
  scenarios: {
    race_condition_burst: {
      executor: 'per-vu-iterations',
      vus: 10,          // 10 concurrent virtual users
      iterations: 1,    // Each fires 1 request simultaneously
      maxDuration: '5s',
    },
  },
};

export function setup() {
  const token = getAuthToken('idempotency_tester');
  // Shared fixed idempotency key across all VUs in this run
  const sharedKey = `race-test-key-${Date.now()}`;
  return { token, sharedKey };
}

export default function (data) {
  const payload = JSON.stringify({
    type: 'email',
    payload: {
      to: 'idempotent_recipient@benchmark.test',
      subject: 'Idempotency Race Test',
      body: 'Multiple concurrent requests with exact same idempotency key.',
    },
  });

  const res = http.post(`${BASE_URL}/api/jobs`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
      'Idempotency-Key': data.sharedKey,
    },
  });

  // Allowed responses under concurrency:
  // 1. 202: First request that acquired the Redis lock
  // 2. 409: In-flight race detected while first request was still processing
  // 3. 200: Handled after first request finished and returned cached duplicate
  const validStatus = check(res, {
    'Status is valid idempotency response (202, 409, or 200)': (r) =>
      r.status === 202 || r.status === 409 || r.status === 200,
  });

  if (res.status === 202) {
    initialCreatedCounter.add(1);
  } else if (res.status === 409 || (res.status === 200 && res.body.includes('isDuplicate'))) {
    deduplicatedOrConflictCounter.add(1);
  }
}

