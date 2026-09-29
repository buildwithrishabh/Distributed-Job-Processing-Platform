/**
 * Typed-ish wrappers around the backend HTTP surface.
 *
 * One function per endpoint, so a backend route change is a one line fix here
 * instead of a hunt through components.
 */

import { request } from "./client.js";

/** Statuses the backend's Job model can hold. */
export const JOB_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "RETRYING",
  "DEAD",
  "CANCELLED",
];

/**
 * Mongoose serialises documents with `_id`, `__v` and `userId`. Strip the
 * internals so components only ever see the fields they render.
 * @param {any} doc
 */
function normalizeJob(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const normalized = { ...doc };
  delete normalized._id;
  delete normalized.__v;
  delete normalized.userId;
  return {
    ...normalized,
    jobId: normalized.jobId ?? null,
    type: normalized.type ?? null,
    status: normalized.status ?? "PENDING",
    payload: normalized.payload ?? {},
    attempts: Number(normalized.attempts ?? 0),
    maxAttempts: Number(normalized.maxAttempts ?? 3),
    priority: Number(normalized.priority ?? 0),
  };
}

/**
 * `cancel` and `retry` answer with `{ message, job }` rather than the document
 * itself, so unwrap the envelope before normalising.
 */
function normalizeJobEnvelope(body) {
  if (body && typeof body === "object" && "job" in body) return normalizeJob(body.job);
  return normalizeJob(body);
}

function normalizeList(body, fallbackLimit = 10) {
  const jobs = Array.isArray(body?.jobs) ? body.jobs.map(normalizeJob) : [];
  const total = Number(body?.total ?? jobs.length) || 0;
  const limit = Number(body?.limit ?? fallbackLimit) || fallbackLimit;
  const page = Number(body?.page ?? 1) || 1;
  return { jobs, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Stable idempotency key so a double-click cannot create two jobs. */
export function newIdempotencyKey(prefix = "njq") {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const auth = {
  me: () => request("/api/auth/me", { auth: "required" }),

  login: (credentials) =>
    request("/api/auth/login", { method: "POST", body: credentials, auth: "none" }),

  register: (payload) =>
    request("/api/auth/register", { method: "POST", body: payload, auth: "none" }),

  logout: () => request("/api/auth/logout", { method: "POST", auth: "optional" }),
};

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Job endpoints.
 *
 * Every wrapper normalises on the way out so no view ever sees a raw Mongoose
 * document, and so list responses always carry `totalPages` — the backend only
 * returns `{ jobs, total, page, limit }`.
 */
export const jobs = {
  list: async ({ page, limit, status, signal } = {}) => {
    const body = await request(`/api/jobs${buildQuery({ page, limit, status })}`, {
      auth: "required",
      signal,
    });
    return normalizeList(body, limit);
  },

  byId: async (jobId, { signal } = {}) => {
    const body = await request(`/api/jobs/${encodeURIComponent(jobId)}`, {
      auth: "required",
      signal,
    });
    return normalizeJob(body);
  },

  create: async (payload, { idempotencyKey } = {}) => {
    const body = await request("/api/jobs", {
      method: "POST",
      auth: "required",
      body: payload,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    });
    return normalizeJob(body);
  },

  cancel: async (jobId) => {
    const body = await request(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      auth: "required",
    });
    return normalizeJobEnvelope(body);
  },

  deadList: async ({ page, limit, signal } = {}) => {
    const body = await request(`/api/jobs/dead${buildQuery({ page, limit })}`, {
      auth: "required",
      signal,
    });
    return normalizeList(body, limit);
  },

  retry: async (jobId) => {
    const body = await request(`/api/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: "POST",
      auth: "required",
    });
    return normalizeJobEnvelope(body);
  },
};

/* -------------------------------------------------------------------------- */
/* Monitoring                                                                 */
/* -------------------------------------------------------------------------- */

export const monitoring = {
  overview: ({ signal } = {}) =>
    request("/api/monitoring/overview", { auth: "required", signal }),

  queue: ({ signal } = {}) => request("/api/monitoring/queue", { auth: "required", signal }),

  jobStats: ({ signal } = {}) => request("/api/monitoring/jobs", { auth: "required", signal }),

  workers: ({ signal } = {}) => request("/api/monitoring/workers", { auth: "required", signal }),
};

/* -------------------------------------------------------------------------- */
/* Optional endpoints (probed, not required)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Runtime configuration. Not implemented by the current backend — the client
 * probes it and falls back to build-time env, then to safe defaults, so the
 * dashboard never displays a capacity number the API did not report.
 */
export const runtimeConfig = {
  get: ({ signal } = {}) => request("/api/config", { auth: "required", signal, timeoutMs: 4_000 }),
};

/** Stream URL for Server-Sent Events. Probed by the live layer. */
export function liveStreamUrl({ token } = {}) {
  const base = import.meta.env?.VITE_SSE_URL || "/api/events";
  const url = new URL(base, window.location.origin);
  // EventSource cannot set headers, so the token rides as a query parameter.
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export const normalizers = { normalizeJob, normalizeJobEnvelope, normalizeList };
