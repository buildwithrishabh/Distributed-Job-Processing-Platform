/**
 * Presentation helpers shared by every job view.
 *
 * Kept as pure functions in one place so a status colour, a timestamp format
 * or a duration label is defined exactly once.
 */

/** @typedef {'PENDING'|'PROCESSING'|'COMPLETED'|'FAILED'|'RETRYING'|'DEAD'|'CANCELLED'} JobStatus */

/** The statuses the backend's Job model can hold, in lifecycle order. */
export const STATUS_ORDER = [
  "PENDING",
  "PROCESSING",
  "RETRYING",
  "COMPLETED",
  "FAILED",
  "DEAD",
  "CANCELLED",
];

/**
 * A status is "in flight" if a worker may still touch it. Used to decide
 * whether cancelling is meaningful.
 * @param {JobStatus} status
 */
export function isActive(status) {
  return status === "PENDING" || status === "PROCESSING" || status === "RETRYING";
}

export function isTerminal(status) {
  return !isActive(status);
}

export function isCancellable(status) {
  return status === "PENDING" || status === "RETRYING";
}

export function isRetriable(status) {
  return status === "FAILED" || status === "DEAD";
}

/** Human label for a status; `CANCELLED` reads better as "Canceled". */
export function statusLabel(status) {
  const value = String(status ?? "").toUpperCase();
  if (value === "CANCELLED") return "Canceled";
  if (value === "RETRYING") return "Retrying";
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** @param {string|number|Date|null|undefined} value */
export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-09-29 14:03:21` — unambiguous and sortable, no locale surprises. */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function formatTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Compact relative time: `just now`, `12s ago`, `4m ago`, `3h ago`, `5d ago`. */
export function formatRelative(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/** `450ms`, `2.3s`, `1m 12s` — for latency and processing time. */
export function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

/** Job execution time, preferring whichever timestamps are populated. */
export function jobDuration(job) {
  if (!job) return null;
  const start = toDate(job.startedAt ?? job.createdAt);
  if (!start) return null;
  const end = toDate(job.completedAt ?? job.failedAt);
  if (!end) return Date.now() - start.getTime();
  return end.getTime() - start.getTime();
}

export function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString();
}

export function formatPercent(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(digits)}%`;
}

/** Truncate a job id from the middle so both ends stay recognisable. */
export function shortId(id, head = 8, tail = 4) {
  const text = String(id ?? "");
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

/** Stable colour for a job type, so the same type is always the same hue. */
export function typeColor(type) {
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ];
  const text = String(type ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 9973;
  }
  return palette[hash % palette.length];
}

/** First line of a job's error, trimmed for table display. */
export function errorSummary(error, max = 90) {
  if (!error) return null;
  const raw =
    typeof error === "object"
      ? error.message || error.error || JSON.stringify(error)
      : error;
  const text = String(raw).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Full detail of a job's error (stack trace or message). */
export function errorDetail(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    return error.stack || error.message || JSON.stringify(error, null, 2);
  }
  return String(error);
}

/**
 * Does this job fail for a reason that retrying cannot fix?
 *
 * The worker treats an `UnrecoverableError` as dead-on-arrival: BullMQ is told
 * not to retry, so the job dies on its first attempt even though `maxAttempts`
 * is 3. The name only survives in `error.stack` (the worker persists
 * `{ message, stack, failedAt }`), so that is what we match on.
 *
 * This distinction is the whole point of the dead-letter queue: a transient
 * failure is worth requeueing, a rejected payload is not.
 * @param {object} job
 */
export function isPermanentFailure(job) {
  if (!job) return false;
  const stack = String(job.error?.stack ?? "");
  const message = String(job.error?.message ?? job.error ?? "");
  return /UnrecoverableError/i.test(stack) || /UnrecoverableError/i.test(message);
}

/**
 * Why a job died, phrased for the person deciding whether to requeue it.
 * @param {object} job
 */
export function failureAdvice(job) {
  if (!job) return null;
  if (isPermanentFailure(job)) {
    return {
      tone: "danger",
      title: "This job cannot succeed on retry",
      body:
        "The processor rejected the job as invalid, so it was never retried — it failed on the first " +
        "attempt even though a retry budget remained. Fix the payload below, then requeue.",
    };
  }

  const attempts = Number(job.attempts ?? 0);
  const maxAttempts = Number(job.maxAttempts ?? 0);
  if (maxAttempts > 0 && attempts >= maxAttempts) {
    return {
      tone: "warning",
      title: "Every attempt was used",
      body:
        `This job failed ${attempts} times and looks like a transient problem (network, timeout, or ` +
        "upstream outage). Requeueing gives it a fresh set of attempts.",
    };
  }

  return null;
}

/** Colour bucket for a worker's health string. */
export function healthTone(health) {
  const value = String(health ?? "").toUpperCase();
  if (value === "HEALTHY" || value === "ACTIVE" || value === "OK") return "success";
  if (value === "STALE" || value === "DRAINING" || value === "BUSY") return "warning";
  if (value === "DEAD" || value === "UNHEALTHY" || value === "ERROR") return "danger";
  return "neutral";
}

export function healthLabel(health) {
  const value = String(health ?? "").toUpperCase();
  return value || "Unknown";
}

/**
 * Derive a capacity tone from a utilisation ratio, so the same thresholds are
 * used by the meter, the tile accents and the alerts.
 * @param {number} ratio 0..1
 */
export function capacityTone(ratio) {
  if (ratio >= 0.95) return "danger";
  if (ratio >= 0.8) return "warning";
  return "normal";
}
