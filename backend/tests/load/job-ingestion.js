import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getAuthToken } from './helpers/auth.js';

// Custom Telemetry Metrics
const jobSubmissionTrend = new Trend('job_submission_duration_ms', true);
const enqueuedJobsCounter = new Counter('total_enqueued_jobs');
const rejectedJobsCounter = new Counter('total_rejected_jobs');

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp-up to 10 concurrent VUs
    { duration: '30s', target: 25 }, // Steady load with 25 VUs
    { duration: '15s', target: 50 }, // Spike to 50 VUs (stress phase)
    { duration: '10s', target: 0 },  // Graceful ramp-down
  ],
  thresholds: {
    // 95% of job submissions should be accepted within 400ms
    http_req_duration: ['p(95)<400'],
    // Less than 5% non-rate-limited failure rate
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const token = getAuthToken('benchmarker');
  return { token };
}

export default function (data) {
  // Generate random email task payload
  const payload = JSON.stringify({
    type: 'email',
    payload: {
      to: `recipient_vu${__VU}_it${__ITER}@benchmark.test`,
      subject: `Automated Load Test Job [VU: ${__VU}, Iter: ${__ITER}]`,
      body: 'High-throughput stress test of distributed job ingestion.',
    },
    priority: Math.floor(Math.random() * 5), // Priority 0-4
    maxAttempts: 3,
  });

  const uniqueIdempotencyKey = `k6-ingest-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
      'Idempotency-Key': uniqueIdempotencyKey,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/jobs`, payload, params);
  jobSubmissionTrend.add(Date.now() - startTime);

  const isAccepted = check(res, {
    'Status is 202 Accepted': (r) => r.status === 202,
    'Response contains jobId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.job && typeof body.job.jobId === 'string';
      } catch (e) {
        return false;
      }
    },
  });

  if (isAccepted) {
    enqueuedJobsCounter.add(1);
  } else {
    // Check if it was rate limited (429) or backpressured (503)
    if (res.status === 429 || res.status === 503) {
      rejectedJobsCounter.add(1);
    } else {
      rejectedJobsCounter.add(1);
    }
  }

  // Slight sleep to maintain steady rhythm
  sleep(0.05);
}

