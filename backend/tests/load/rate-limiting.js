import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, getAuthToken } from './helpers/auth.js';

const rateLimitHits = new Counter('rate_limit_429_hits');
const acceptedRequests = new Counter('accepted_202_requests');

export const options = {
  scenarios: {
    burst_test: {
      executor: 'per-vu-iterations',
      vus: 1,           // Single user bursting requests
      iterations: 25,   // 25 requests in rapid succession (Limit is 10/min)
      maxDuration: '10s',
    },
  },
  thresholds: {
    // We explicitly EXPECT rate limiter to trigger 429s when exceeding 10 requests!
    rate_limit_429_hits: ['count>5'],
  },
};

export function setup() {
  const token = getAuthToken('burst_user');
  return { token };
}

export default function (data) {
  const payload = JSON.stringify({
    type: 'email',
    payload: {
      to: 'burst_target@benchmark.test',
      subject: 'Burst Rate Limit Test',
      body: 'Testing sliding-window rate limiter.',
    },
  });

  const res = http.post(`${BASE_URL}/api/jobs`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
      'Idempotency-Key': `burst-${__ITER}-${Date.now()}`,
    },
  });

  if (res.status === 202) {
    acceptedRequests.add(1);
  } else if (res.status === 429) {
    rateLimitHits.add(1);
    check(res, {
      '429 response has Retry-After header': (r) => r.headers['Retry-After'] !== undefined,
      '429 response has X-RateLimit-Limit header': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
      '429 response body contains Too Many Requests': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.error === 'Too Many Requests';
        } catch (e) {
          return false;
        }
      },
    });
  }

  check(res, {
    'Response is either 202 Accepted or 429 Rate Limited': (r) => r.status === 202 || r.status === 429,
  });
}

