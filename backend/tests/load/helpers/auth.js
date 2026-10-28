import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

/**
 * Creates and logs in a dedicated load test user to obtain a valid JWT Bearer access token.
 */
export function getAuthToken(prefix = 'k6_user') {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const testUser = {
    name: 'K6 Load Tester',
    email: `${prefix}_${timestamp}_${randomSuffix}@benchmark.local`,
    password: 'Password123!',
  };

  const headers = { 'Content-Type': 'application/json' };

  // 1. Register test user
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify(testUser),
    { headers }
  );

  check(regRes, {
    'Auth Setup: User registered successfully (201)': (r) => r.status === 201,
  });

  // 2. Login to receive access token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: testUser.email,
      password: testUser.password,
    }),
    { headers }
  );

  const loginSuccess = check(loginRes, {
    'Auth Setup: User logged in successfully (200)': (r) => r.status === 200,
    'Auth Setup: Access token returned': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.accessToken === 'string' && body.accessToken.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  if (!loginSuccess) {
    throw new Error(`Failed to obtain JWT auth token: ${loginRes.status} ${loginRes.body}`);
  }

  const loginBody = JSON.parse(loginRes.body);
  return loginBody.accessToken;
}

