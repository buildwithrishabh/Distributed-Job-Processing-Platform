import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getAuthToken } from './helpers/auth.js';

export const options = {
  vus: 3,
  duration: '15s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% failures
    http_req_duration: ['p(95)<150'], // 95% requests should complete under 150ms
  },
};

export function setup() {
  const token = getAuthToken('smoke_tester');
  return { token };
}

export default function (data) {
  // 1. Check Public /health
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'GET /health returns 200': (r) => r.status === 200,
    'Health status is ok': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch (e) {
        return false;
      }
    },
  });

  // 2. Check Observability /metrics (Prometheus scrape endpoint)
  const metricsRes = http.get(`${BASE_URL}/metrics`);
  check(metricsRes, {
    'GET /metrics returns 200': (r) => r.status === 200,
    'Metrics contain prom-client data': (r) => r.body.includes('job_platform_') || r.body.includes('process_cpu_'),
  });

  // 3. Check Authenticated GET /api/jobs
  const jobsRes = http.get(`${BASE_URL}/api/jobs`, {
    headers: {
      Authorization: `Bearer ${data.token}`,
    },
  });

  check(jobsRes, {
    'GET /api/jobs returns 200': (r) => r.status === 200,
  });

  sleep(1);
}

