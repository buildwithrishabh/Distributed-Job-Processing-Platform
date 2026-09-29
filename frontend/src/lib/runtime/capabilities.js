/**
 * Runtime capability negotiation.
 *
 * The dashboard needs a handful of values that the HTTP API does not currently
 * return — most importantly `MAX_QUEUE_CAPACITY`, which the old UI hardcoded to
 * 1000 while the backend ran with 50000. Rather than repeat that mistake (or
 * edit the backend), we probe for an optional `/api/config` endpoint and fall
 * back through build-time env values to conservative defaults.
 *
 * Every resolved value carries a `source` so the UI can label it honestly
 * instead of presenting a guess as fact.
 */

import { runtimeConfig } from "../api/endpoints.js";
import { ApiError } from "../api/errors.js";

/** @typedef {'api'|'env'|'default'} ValueSource */

/** Conservative default when nothing else is available. */
const DEFAULTS = Object.freeze({
  maxQueueCapacity: 1000,
  workerConcurrency: 5,
  rateLimitMax: 10,
  rateLimitWindowSeconds: 60,
  jobTypes: [{ id: "email", label: "Email dispatch" }],
  queueName: "job-queue",
  heartbeatIntervalSeconds: 10,
  heartbeatTtlSeconds: 30,
});

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fromEnv(key) {
  const raw = import.meta.env?.[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * @typedef {object} RuntimeConfig
 * @property {number} maxQueueCapacity
 * @property {'api'|'env'|'default'} maxQueueCapacitySource
 * @property {number} workerConcurrency
 * @property {'api'|'env'|'default'} workerConcurrencySource
 * @property {number} rateLimitMax
 * @property {number} rateLimitWindowSeconds
 * @property {Array<{id:string,label:string}>} jobTypes
 * @property {string} queueName
 * @property {number} heartbeatIntervalSeconds
 * @property {number} heartbeatTtlSeconds
 */

/** @returns {RuntimeConfig} */
export function resolveConfig() {
  /** @type {any} */
  let fromApi = {};
  try {
    const raw = fromEnv("VITE_RUNTIME_CONFIG");
    if (raw) fromApi = JSON.parse(raw);
  } catch {
    fromApi = {};
  }

  const pick = (apiKey, envKey, envParser, defaultValue) => {
    const apiValue = fromApi?.[apiKey];
    if (apiValue !== undefined && apiValue !== null) {
      return { value: apiValue, source: "api" };
    }
    const envValue = fromEnv(envKey);
    if (envValue !== null) {
      return { value: envParser ? envParser(envValue) : envValue, source: "env" };
    }
    return { value: defaultValue, source: "default" };
  };

  const capacity = pick("maxQueueCapacity", "VITE_MAX_QUEUE_CAPACITY", (v) => num(v, 0), DEFAULTS.maxQueueCapacity);
  const concurrency = pick("workerConcurrency", "VITE_WORKER_CONCURRENCY", (v) => num(v, 0), DEFAULTS.workerConcurrency);
  const rateLimit = pick("rateLimitMax", "VITE_RATE_LIMIT_MAX", (v) => num(v, 0), DEFAULTS.rateLimitMax);
  const window = pick("rateLimitWindowSeconds", "VITE_RATE_LIMIT_WINDOW_SECONDS", (v) => num(v, 0), DEFAULTS.rateLimitWindowSeconds);
  const queueName = pick("queueName", "VITE_QUEUE_NAME", null, DEFAULTS.queueName);
  const heartbeatInterval = pick("heartbeatIntervalSeconds", "VITE_HEARTBEAT_INTERVAL_SECONDS", (v) => num(v, 0), DEFAULTS.heartbeatIntervalSeconds);
  const heartbeatTtl = pick("heartbeatTtlSeconds", "VITE_HEARTBEAT_TTL_SECONDS", (v) => num(v, 0), DEFAULTS.heartbeatTtlSeconds);

  const jobTypesRaw = fromApi?.jobTypes ?? fromEnv("VITE_JOB_TYPES");
  let jobTypes = DEFAULTS.jobTypes;
  if (Array.isArray(jobTypesRaw) && jobTypesRaw.length) {
    jobTypes = jobTypesRaw.map((t) =>
      typeof t === "string" ? { id: t, label: t } : { id: t.id, label: t.label ?? t.id },
    );
  }

  return {
    maxQueueCapacity: num(capacity.value, DEFAULTS.maxQueueCapacity),
    maxQueueCapacitySource: capacity.source,
    workerConcurrency: num(concurrency.value, DEFAULTS.workerConcurrency),
    workerConcurrencySource: concurrency.source,
    rateLimitMax: num(rateLimit.value, DEFAULTS.rateLimitMax),
    rateLimitWindowSeconds: num(window.value, DEFAULTS.rateLimitWindowSeconds),
    jobTypes,
    queueName: String(queueName.value ?? DEFAULTS.queueName),
    heartbeatIntervalSeconds: num(heartbeatInterval.value, DEFAULTS.heartbeatIntervalSeconds),
    heartbeatTtlSeconds: num(heartbeatTtl.value, DEFAULTS.heartbeatTtlSeconds),
  };
}

/**
 * Ask the API for its live configuration. Resolves to `null` when the endpoint
 * is absent (404) or unreachable — both are expected, not errors.
 * @returns {Promise<{config:any, available:boolean, reason?:string}>}
 */
export async function probeRuntimeConfig() {
  try {
    const data = await runtimeConfig.get();
    const config = data?.config ?? data;
    if (config && typeof config === "object") {
      return { config, available: true };
    }
    return { config: null, available: false, reason: "empty_response" };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.kind === "notFound") return { config: null, available: false, reason: "not_implemented" };
      if (error.kind === "auth") return { config: null, available: false, reason: "unauthorized" };
      return { config: null, available: false, reason: error.kind };
    }
    return { config: null, available: false, reason: "unknown" };
  }
}

/** Describes where a value came from, for display in Settings. */
export const SOURCE_LABEL = {
  api: "Reported by the API",
  env: "Set by VITE_ environment variable",
  default: "Built-in fallback (not confirmed by the API)",
};
