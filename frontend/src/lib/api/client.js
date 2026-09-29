/**
 * HTTP transport.
 *
 * Responsibilities
 * ----------------
 * - resolve the API origin, append paths safely
 * - attach `Authorization: Bearer` and `credentials: include` so either the
 *   cookie or the header channel authenticates the request
 * - renew the access token *proactively* (before expiry) and *reactively* (on
 *   401), with a single in-flight refresh shared by all waiting callers
 * - time out requests so a hung socket can never wedge the UI
 * - translate every failure into a typed `ApiError`
 * - surface `X-RateLimit-*` and `Retry-After` so the UI can show real quota
 */

import { ApiError, extractDetails, extractMessage } from "./errors.js";
import { apiEvents } from "./events.js";
import { getAccessToken, needsRefresh, setAccessToken, clearAccessToken } from "./token.js";
import { resolveOrigin } from "./url.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const REFRESH_TIMEOUT_MS = 10_000;
const MAX_REFRESH_ATTEMPTS = 2;

/** Shared state for the single-flight refresh. */
let refreshPromise = null;
let refreshAttempts = 0;

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

function joinUrl(path) {
  const origin = resolveOrigin();
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function readRateLimit(headers) {
  const limit = Number(headers.get("X-RateLimit-Limit"));
  const remaining = Number(headers.get("X-RateLimit-Remaining"));
  if (!Number.isFinite(limit) && !Number.isFinite(remaining)) return null;
  return {
    limit: Number.isFinite(limit) ? limit : null,
    remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : null,
  };
}

function readRetryAfter(headers) {
  const raw = headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(1, Math.round(seconds));
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.max(1, Math.round((date - Date.now()) / 1000));
  return null;
}

async function readBody(response) {
  if (response.status === 204 || response.status === 205) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    const text = await response.text().catch(() => "");
    return text || null;
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError("The API returned malformed JSON.", {
      status: response.status,
      kind: "parse",
      cause: new Error("JSON parse failure"),
    });
  }
}

/** Merge a caller signal with our own timeout signal. */
function withTimeout(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) onExternalAbort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

function translateTransportError(error, timeoutMs) {
  if (error instanceof ApiError) return error;

  const name = error?.name;
  if (name === "TimeoutError") {
    return new ApiError(`The API did not respond within ${Math.round(timeoutMs / 1000)}s.`, {
      kind: "timeout",
      cause: error,
    });
  }
  if (name === "AbortError") {
    return new ApiError("Request cancelled.", { kind: "aborted", cause: error });
  }
  if (error instanceof TypeError) {
    // `fetch` rejects with TypeError for DNS, TLS, CORS and connection-refused.
    return new ApiError(undefined, { kind: "network", cause: error });
  }
  return new ApiError(error?.message || "Unexpected transport failure.", {
    kind: "client",
    cause: error,
  });
}

/* -------------------------------------------------------------------------- */
/* Token refresh                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Perform the refresh call. Exported so the auth context can force one.
 * `singleFlight` is false only for the forced path.
 */
async function performRefresh() {
  const { signal, cleanup } = withTimeout(REFRESH_TIMEOUT_MS);
  try {
    const response = await fetch(joinUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });

    const body = await readBody(response).catch(() => null);

    if (!response.ok) {
      // 401/403 on refresh means the session is genuinely gone.
      clearAccessToken();
      apiEvents.emit("auth:expired", { reason: "refresh_rejected", status: response.status });
      throw new ApiError(
        extractMessage(body) || "Your session has ended. Please sign in again.",
        { status: response.status, kind: "auth" },
      );
    }

    const token = body?.accessToken;
    if (typeof token !== "string" || !token) {
      clearAccessToken();
      apiEvents.emit("auth:expired", { reason: "refresh_no_token" });
      throw new ApiError("Refresh response did not include a token.", { kind: "auth" });
    }

    setAccessToken(token);
    refreshAttempts = 0;
    apiEvents.emit("auth:restored", { user: body?.user ?? null });
    return body;
  } finally {
    cleanup();
  }
}

/**
 * Refresh the session, coalescing concurrent callers onto one request.
 *
 * There is deliberately no "force" escape hatch: single-flight is the whole
 * point, and a second in-flight refresh would race the first one to clear the
 * token on failure.
 */
export function refreshSession() {
  if (refreshPromise) return refreshPromise;

  refreshAttempts += 1;
  if (refreshAttempts > MAX_REFRESH_ATTEMPTS) {
    refreshAttempts = 0;
    clearAccessToken();
    const error = new ApiError("Session could not be renewed. Please sign in again.", {
      kind: "auth",
    });
    apiEvents.emit("auth:expired", { reason: "refresh_exhausted" });
    return Promise.reject(error);
  }

  refreshPromise = performRefresh()
    .catch((error) => {
      if (error?.kind === "auth") clearAccessToken();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export function isRefreshing() {
  return refreshPromise !== null;
}

/* -------------------------------------------------------------------------- */
/* Public request function                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {object} RequestOptions
 * @property {string} [method]
 * @property {unknown} [body]        JSON-serialised automatically
 * @property {Record<string,string>} [headers]
 * @property {AbortSignal} [signal]
 * @property {number} [timeoutMs]
 * @property {'required'|'optional'|'none'} [auth]
 * @property {boolean} [allowRefresh] set false to opt out of the 401 retry loop
 * @property {number} [refreshAttempt]
 */

/**
 * @param {string} path
 * @param {RequestOptions} [options]
 * @returns {Promise<any>}
 */
export async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    headers: extraHeaders,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = "optional",
    allowRefresh = true,
    refreshAttempt = 0,
  } = options;

  // Proactive renewal: never send a token that is about to die.
  if (auth !== "none" && allowRefresh && needsRefresh() && getAccessToken()) {
    try {
      await refreshSession();
    } catch {
      // Fall through — the request itself will produce a proper 401 if needed.
    }
  }

  const headers = new Headers(extraHeaders ?? {});
  headers.set("Accept", "application/json");

  let payload;
  if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    payload = body;
  } else if (body !== undefined && body !== null) {
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  const token = getAccessToken();
  if (auth !== "none" && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const { signal, cleanup } = withTimeout(timeoutMs, externalSignal);
  const startedAt = nowMs();

  let response;
  try {
    response = await fetch(joinUrl(path), {
      method,
      headers,
      body: payload,
      signal,
      credentials: "include",
      mode: "cors",
      cache: "no-store",
    });
  } catch (error) {
    throw translateTransportError(error, timeoutMs);
  } finally {
    cleanup();
  }

  const latency = nowMs() - startedAt;
  const rateLimit = readRateLimit(response.headers);
  const retryAfter = readRetryAfter(response.headers);

  if (response.status === 429) {
    const data = await readBody(response).catch(() => null);
    const seconds = retryAfter ?? 60;
    apiEvents.emit("throttled", {
      kind: "rateLimit",
      retryAfter: seconds,
      rateLimit,
      message: extractMessage(data) ?? "Rate limit reached.",
    });
    throw new ApiError(
      extractMessage(data) ?? `Rate limit reached. Retry in ${seconds}s.`,
      { status: 429, kind: "rateLimit", retryAfter: seconds, rateLimit, payload: data },
    );
  }

  if (response.status === 503) {
    const data = await readBody(response).catch(() => null);
    const seconds = retryAfter ?? 30;
    apiEvents.emit("throttled", {
      kind: "backpressure",
      retryAfter: seconds,
      currentQueueSize: data?.currentQueueSize ?? null,
      maxCapacity: data?.maxCapacity ?? null,
      message: extractMessage(data) ?? "Queue is at capacity.",
    });
    throw new ApiError(
      extractMessage(data) ?? `Queue capacity reached. Retry in ${seconds}s.`,
      { status: 503, kind: "backpressure", retryAfter: seconds, payload: data },
    );
  }

  if (response.status === 401 && auth !== "none" && allowRefresh && refreshAttempt < 1) {
    // Reactive renewal: exactly one retry, never a loop. A failed refresh
    // rejects with an auth error and the caller's catch handles it.
    await refreshSession();
    return request(path, { ...options, allowRefresh: false, refreshAttempt: refreshAttempt + 1 });
  }

  if (response.status === 401) {
    const data = await readBody(response).catch(() => null);
    if (auth !== "none") {
      clearAccessToken();
      apiEvents.emit("auth:expired", { reason: "unauthorized", status: 401 });
    }
    throw new ApiError(extractMessage(data) ?? "Not authenticated.", {
      status: 401,
      kind: "auth",
      code: data?.code ?? null,
      payload: data,
    });
  }

  if (!response.ok) {
    const data = await readBody(response).catch(() => null);
    throw new ApiError(extractMessage(data) ?? `Request failed (${response.status}).`, {
      status: response.status,
      kind: undefined,
      details: extractDetails(data),
      payload: data,
    });
  }

  const result = await readBody(response);

  if (result && typeof result === "object") {
    Object.defineProperty(result, "__latency", { value: latency, enumerable: false });
    if (rateLimit) Object.defineProperty(result, "__rateLimit", { value: rateLimit, enumerable: false });
  }

  return result;
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

/* -------------------------------------------------------------------------- */
/* Health probe (public, no auth)                                             */
/* -------------------------------------------------------------------------- */

export async function probeHealth({ signal } = {}) {
  const startedAt = nowMs();
  try {
    const data = await request("/health", { auth: "none", signal, timeoutMs: 6_000 });
    return {
      online: data?.status === "OK" || data?.status === "ok",
      latency: Math.round(nowMs() - startedAt),
      body: data ?? null,
    };
  } catch (error) {
    return {
      online: false,
      latency: null,
      error: error instanceof ApiError ? error.displayMessage : "Unreachable",
    };
  }
}
