/**
 * Single source of truth for cluster metrics.
 *
 * Both transports write here: the SSE stream (push) and the poller (fallback
 * plus slow reconciliation). Components read through `useSyncExternalStore`, so
 * there is exactly one render path regardless of how the data arrived.
 *
 * Polling is deliberately not a dumb `setInterval`:
 *   - it pauses when the tab is hidden and resumes with an immediate fetch
 *   - it backs off when errors accumulate
 *   - it pauses entirely when the browser reports the device is offline
 */

import { monitoring } from "../api/endpoints.js";
import { ApiError } from "../api/errors.js";
import { LiveStream } from "./LiveStream.js";
import { RingBuffer } from "./history.js";

const HISTORY_POINTS = 60;
const POLL_FAST_MS = 4_000;
const POLL_SLOW_MS = 12_000;
const POLL_RECONCILE_MS = 60_000;
const MAX_BACKOFF_MS = 60_000;

/** @typedef {'idle'|'connecting'|'open'|'unsupported'|'error'} StreamState */
/** @typedef {'idle'|'sse'|'poll'} Transport */

/** @type {import('./LiveStream.js')} */
let stream = null;

const history = new RingBuffer(HISTORY_POINTS);

let state = {
  /** @type {'idle'|'loading'|'ready'|'error'} */
  status: "idle",
  /** @type {ApiError|null} */
  error: null,
  /** @type {{queue:any,jobs:any,workers:any,timestamp:string}|null} */
  overview: null,
  /** @type {Transport} */
  transport: "idle",
  /** @type {StreamState} */
  streamState: "idle",
  lastUpdatedAt: null,
  latencyMs: null,
  consecutiveErrors: 0,
  active: false,
};

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {ReturnType<typeof setTimeout>|null} */
let pollTimer = null;
/** @type {AbortController|null} */
let inFlight = null;
let startedAt = 0;

function emit(patch) {
  const next = { ...state, ...patch };
  const changed = Object.keys(patch).some((key) => next[key] !== state[key]);
  state = next;
  if (changed) listeners.forEach((listener) => listener());
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHistory() {
  return history;
}

/* -------------------------------------------------------------------------- */
/* Polling                                                                    */
/* -------------------------------------------------------------------------- */

function currentInterval() {
  // Errors always dominate: back off exponentially regardless of load.
  if (state.consecutiveErrors > 0) {
    // 4s, 8s, 16s, 32s, 60s …
    return Math.min(POLL_FAST_MS * 2 ** state.consecutiveErrors, MAX_BACKOFF_MS);
  }

  // Nothing moving: there is no point asking every four seconds whether the
  // queue is still empty. The stream (or a manual refresh) wakes us back up.
  const queue = state.overview?.queue ?? {};
  const jobs = state.overview?.jobs ?? {};
  const busy =
    Number(queue.waiting ?? 0) > 0 ||
    Number(queue.active ?? 0) > 0 ||
    Number(queue.paused ?? 0) > 0 ||
    Number(jobs.PROCESSING ?? 0) > 0;

  return busy ? POLL_FAST_MS : POLL_SLOW_MS;
}

function shouldPoll() {
  if (!state.active) return false;
  if (stream?.isOpen) return false; // push transport is healthy
  if (typeof document !== "undefined" && document.hidden) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return true;
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (!shouldPoll()) return;

  // When the stream is healthy we still reconcile slowly so a dropped frame
  // cannot leave the dashboard showing stale numbers indefinitely.
  const delay = stream?.isOpen ? POLL_RECONCILE_MS : currentInterval();
  pollTimer = setTimeout(runPoll, delay);
}

function applyOverview(data) {
  if (!data || typeof data !== "object") return;
  const queue = data.queue ?? {};
  const jobs = data.jobs ?? {};
  const workers = data.workers ?? {};

  history.push({
    t: Date.now(),
    waiting: Number(queue.waiting ?? 0),
    active: Number(queue.active ?? 0),
    completed: Number(jobs.COMPLETED ?? 0),
    failed: Number(jobs.FAILED ?? 0),
    dead: Number(jobs.DEAD ?? 0),
    workers: Number(workers.activeWorkerCount ?? 0),
  });

  emit({ overview: data, lastUpdatedAt: Date.now() });
}

async function runPoll({ silent = false } = {}) {
  if (!state.active) return;
  if (inFlight) return;

  inFlight?.abort();
  const controller = new AbortController();
  inFlight = controller;

  if (!silent && !state.overview) emit({ status: "loading" });

  try {
    const data = await monitoring.overview({ signal: controller.signal });
    applyOverview(data);
    emit({
      status: "ready",
      error: null,
      consecutiveErrors: 0,
      latencyMs: data?.__latency ?? null,
    });
  } catch (error) {
    if (error?.kind === "aborted") return;

    const apiError =
      error instanceof ApiError ? error : new ApiError("Failed to load metrics.", { kind: "network" });

    // A 401 is handled globally by the auth layer; don't shout about it here.
    if (apiError.kind !== "auth") {
      emit({
        status: state.overview ? "ready" : "error",
        error: apiError,
        consecutiveErrors: state.consecutiveErrors + 1,
      });
    }
  } finally {
    inFlight = null;
    schedulePoll();
  }
}

/* -------------------------------------------------------------------------- */
/* Stream wiring                                                              */
/* -------------------------------------------------------------------------- */

function connectStream() {
  if (stream) return;
  stream = new LiveStream({
    onStateChange(streamState) {
      emit({ streamState });
      if (streamState === "open") emit({ transport: "sse" });
      else if (streamState === "unsupported" || streamState === "error") {
        emit({ transport: state.overview ? "poll" : "idle" });
      }
      schedulePoll();
    },
    onMessage(payload, type) {
      switch (type) {
        case "overview":
          applyOverview(payload?.data ?? payload);
          break;
        case "queue":
        case "jobs":
        case "workers": {
          if (!state.overview) return;
          // Partial frame: merge into the last full snapshot.
          const key = type === "queue" ? "queue" : type === "jobs" ? "jobs" : "workers";
          applyOverview({ ...state.overview, [key]: payload?.data ?? payload });
          break;
        }
        default:
          break;
      }
    },
  });
  stream.connect();
}

function handleVisibility() {
  if (typeof document === "undefined") return;
  if (!document.hidden) {
    // Coming back to a stale tab: refresh immediately, don't wait a full tick.
    if (state.active) runPoll({ silent: true });
    else schedulePoll();
  } else {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function handleOnline() {
  if (state.active) runPoll({ silent: true });
}

let listenersAttached = false;

function attachGlobalListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("online", handleOnline);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Begin tracking metrics. Idempotent.
 * @param {{ enabled?: boolean }} [options]
 */
export function startMetrics({ enabled = true } = {}) {
  if (state.active === enabled) return;
  attachGlobalListeners();

  if (!enabled) {
    clearTimeout(pollTimer);
    pollTimer = null;
    inFlight?.abort();
    inFlight = null;
    stream?.close();
    stream = null;
    history.clear();
    // `active` must be set through emit, not by mutation: emit compares the
    // patch against the previous state to decide whether to notify listeners,
    // so a pre-mutation would silently suppress the update.
    emit({ active: false, status: "idle", transport: "idle", streamState: "idle" });
    return;
  }

  startedAt = Date.now();
  emit({ active: true, status: state.overview ? "ready" : "loading" });
  connectStream();
  runPoll();
}

export function stopMetrics() {
  startMetrics({ enabled: false });
}

/** Force an immediate refresh regardless of transport. */
export function refreshMetrics() {
  if (!state.active) return Promise.resolve();
  return runPoll({ silent: true });
}

export function isSseAvailable() {
  return Boolean(stream && !stream.unsupported);
}

export function secondsSinceUpdate() {
  if (!state.lastUpdatedAt) return null;
  return Math.floor((Date.now() - state.lastUpdatedAt) / 1000);
}

export function sessionUptimeSeconds() {
  return startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
}
