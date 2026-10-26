const rawApiUrl = (import.meta.env.VITE_API_URL || "/api").trim().replace(/\/+$/, "");
const API_URL = rawApiUrl.endsWith("/api") ? rawApiUrl : `${rawApiUrl}/api`;

let authToken = typeof window !== "undefined" ? localStorage.getItem("job_platform_token") : null;

export const setAuthToken = (token) => {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("job_platform_token", token);
    else localStorage.removeItem("job_platform_token");
  }
};

async function request(path, options = {}, canRefresh = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new Error(`Could not reach the API at ${API_URL}. Check the API URL and server.`);
  }
  if (response.status === 401 && canRefresh && path !== "/auth/login" && path !== "/auth/register" && path !== "/auth/refresh") {
    const refreshed = await request("/auth/refresh", { method: "POST" }, false).catch(() => null);
    if (refreshed?.accessToken) {
      setAuthToken(refreshed.accessToken);
      return request(path, options, false);
    }
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (data?.accessToken) {
    setAuthToken(data.accessToken);
  }
  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = data.details;
    error.retryAfter = data.retryAfter || Number(response.headers.get("Retry-After")) || null;
    throw error;
  }
  return data;
}

const json = (method, body, headers) => ({ method, body: JSON.stringify(body), headers });

export const api = {
  me: () => request("/auth/me"),
  login: async (email, password) => {
    const res = await request("/auth/login", json("POST", { email, password }));
    if (res?.accessToken) setAuthToken(res.accessToken);
    return res;
  },
  register: (name, email, password) => request("/auth/register", json("POST", { name, email, password })),
  logout: async () => {
    try {
      return await request("/auth/logout", { method: "POST" });
    } finally {
      setAuthToken(null);
    }
  },
  overview: () => request("/monitoring/overview"),
  queue: () => request("/monitoring/queue"),
  stats: () => request("/monitoring/jobs"),
  workers: () => request("/monitoring/workers"),
  jobs: (page = 1, limit = 10, status = "") => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set("status", status);
    return request(`/jobs?${params}`);
  },
  job: (id) => request(`/jobs/${encodeURIComponent(id)}`),
  createJob: (body, key) => request("/jobs", json("POST", body, key ? { "Idempotency-Key": key } : {})),
  cancelJob: (id) => request(`/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  deadJobs: (page = 1, limit = 10) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return request(`/jobs/dead?${params}`);
  },
  retryJob: (id) => request(`/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" }),
};
