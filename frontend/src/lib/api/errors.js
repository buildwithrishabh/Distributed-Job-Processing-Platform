/**
 * Normalised error taxonomy for every network call.
 *
 * The backend historically returned four different error shapes
 * (`{ error }`, `{ message }`, `{ success, error }`, `{ error, details }`), and a
 * raw `fetch` rejection for anything network related. Everything is funnelled
 * into a single `ApiError` so the UI can branch on `kind` instead of guessing.
 */

/** @typedef {'network'|'timeout'|'aborted'|'auth'|'forbidden'|'notFound'|'validation'|'rateLimit'|'backpressure'|'server'|'parse'|'client'} ApiErrorKind */

const STATUS_KIND = {
  400: "client",
  401: "auth",
  403: "forbidden",
  404: "notFound",
  409: "conflict",
  413: "client",
  422: "validation",
  429: "rateLimit",
  500: "server",
  502: "server",
  503: "backpressure",
  504: "timeout",
};

const KIND_MESSAGE = {
  network: "Cannot reach the API. Check that the backend is running and the endpoint is correct.",
  timeout: "The API did not respond in time.",
  aborted: "Request cancelled.",
  auth: "Your session has expired. Please sign in again.",
  forbidden: "You do not have access to this resource.",
  notFound: "Resource not found.",
  conflict: "That resource already exists.",
  validation: "Some fields need attention.",
  rateLimit: "Rate limit reached. Slow down and retry shortly.",
  backpressure: "The queue is at capacity. New submissions are paused.",
  server: "The API hit an internal error.",
  parse: "The API returned a response we could not read.",
  client: "The request was rejected.",
};

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {object} [options]
   * @param {number} [options.status]
   * @param {ApiErrorKind} [options.kind]
   * @param {string} [options.code]
   * @param {Array<{field:string,message:string}>} [options.details]
   * @param {number} [options.retryAfter]
   * @param {object} [options.payload]
   * @param {Error} [options.cause]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.kind = options.kind ?? kindForStatus(options.status);
    this.code = options.code ?? null;
    this.details = options.details ?? [];
    this.retryAfter = options.retryAfter ?? null;
    this.payload = options.payload ?? null;
    this.rateLimit = options.rateLimit ?? null;
    if (options.cause) this.cause = options.cause;
  }

  get isAuth() {
    return this.kind === "auth";
  }

  get isRetryable() {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "server";
  }

  /** User-facing text, always safe to render. */
  get displayMessage() {
    if (this.message) return this.message;
    return KIND_MESSAGE[this.kind] ?? "Something went wrong.";
  }

  /** Field level message, derived from `details` when present. */
  fieldError(field) {
    const hit = this.details.find(
      (d) => d && typeof d.field === "string" && d.field.toLowerCase() === field.toLowerCase(),
    );
    return hit?.message ?? null;
  }
}

/** @param {number|undefined} status */
function kindForStatus(status) {
  if (!status) return "client";
  return STATUS_KIND[status] ?? (status >= 500 ? "server" : "client");
}

/**
 * Pull a human message out of any of the backend's error shapes.
 * @param {any} body
 */
export function extractMessage(body) {
  if (!body || typeof body !== "object") return null;
  const candidates = [body.error, body.message];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  // `{ error: { message } }` shape
  if (body.error && typeof body.error === "object" && typeof body.error.message === "string") {
    return body.error.message.trim();
  }
  if (Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map((e) => e?.message).filter(Boolean).join("; ") || null;
  }
  return null;
}

/**
 * Normalise the `details` array used by the zod validation middleware.
 * @param {any} body
 * @returns {Array<{field:string,message:string}>}
 */
export function extractDetails(body) {
  if (!body || typeof body !== "object") return [];
  const raw = body.details ?? body.errors;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { field: "form", message: item };
      if (item && typeof item === "object") {
        const field = item.field ?? (Array.isArray(item.path) ? item.path.join(".") : null);
        const message = item.message ?? null;
        if (message) return { field: field || "form", message };
      }
      return null;
    })
    .filter(Boolean);
}

/** @param {number|undefined} status */
export function kindForStatusCode(status) {
  return kindForStatus(status);
}
