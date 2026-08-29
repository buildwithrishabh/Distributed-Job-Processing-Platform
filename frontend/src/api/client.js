import axios from 'axios';

// ---------------------------------------------------------------------------
// Session helpers — the backend keeps tokens in httpOnly cookies, so JS cannot
// read them. The access token is ALSO returned in the login response body and
// stored here as an optimisation (avoids waiting for the silent-refresh path).
// ---------------------------------------------------------------------------
export const TOKEN_KEY = 'accessToken';
export const USER_KEY = 'user';

export function storeSession({ accessToken, user }) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('auth:unauthorized'));
}

// Decode an unexpired JWT payload (id/email/name/role) without a server round
// trip. Used to restore a full user profile on app load when the stored user
// object is missing but a valid token still exists.
export function decodeUserFromToken() {
  const token = getStoredToken();
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload || typeof payload !== 'object' || !payload.id) return null;
    return { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Base API instance
// ---------------------------------------------------------------------------
const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly accessToken & refreshToken cookies
});

// Attach the access token from localStorage when present (fallback for auth,
// the authoritative source of truth is the httpOnly cookie).
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Single-flight token refresh — concurrent 401s share ONE refresh call instead
// of stampeding the auth service.
// ---------------------------------------------------------------------------
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/health'];

let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then((res) => res.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function isAuthOrPublicPath(url = '') {
  return AUTH_PATHS.some((p) => url.includes(p));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !isAuthOrPublicPath(originalRequest.url)
    ) {
      originalRequest._retry = true;
      try {
        const data = await refreshAccessToken();
        if (data && data.accessToken) {
          storeSession({ accessToken: data.accessToken, user: data.user });
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        clearSession();
      }
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Error normalisation — the backend uses three different error shapes:
//   { message: "..." }                         (auth controllers)
//   { success:false, error: "..." }            (global handler / auth middleware)
//   { error:"Validation Error", details:[...] }(zod validation)
// This collapses every failure into a single { message, status } object so
// components never have to guess.
// ---------------------------------------------------------------------------
export function getErrorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;

  const status = err.response?.status ?? err.status ?? 0;
  const data = err.response?.data;

  if (data) {
    if (data.error === 'Validation Error' && Array.isArray(data.details)) {
      return data.details.map((d) => d.message).join('\n');
    }
    if (typeof data.error === 'string') return data.error;
    if (typeof data.message === 'string') return data.message;
  }

  if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
  if (!status) return 'Unable to reach the server. Check your connection.';

  return fallback;
}

export function isAuthError(err) {
  return err?.response?.status === 401;
}

export default api;