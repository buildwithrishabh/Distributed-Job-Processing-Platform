/**
 * Server-Sent Events client with graceful degradation.
 *
 * The current backend has no `/api/events` route, so opening a stream simply
 * fails. That is treated as a *capability gap*, not an error:
 *   - if the stream does not open within `PROBE_TIMEOUT_MS`, close it and
 *     latch to polling for the rest of the session (no retry storm, no noise)
 *   - if it opens, the dashboard stops polling and updates from push
 *   - polling always resumes as a slow reconciliation net, so a missed event
 *     can never leave stale numbers on screen
 *
 * Nothing in the UI branches on "SSE vs poll" — both paths write into the same
 * store, so switching transports is invisible.
 */

import { liveStreamUrl } from "../api/endpoints.js";
import { getAccessToken } from "../api/token.js";

/** Give the server this long to accept the stream before declaring it absent. */
const PROBE_TIMEOUT_MS = 4_000;

/** Events the backend is expected to publish. Anything else is ignored. */
const KNOWN_EVENTS = ["overview", "queue", "jobs", "workers", "job", "worker", "ping"];

export class LiveStream {
  /**
   * @param {object} options
   * @param {(payload:any, type:string)=>void} options.onMessage
   * @param {(state:'connecting'|'open'|'unsupported'|'error')=>void} [options.onStateChange]
   */
  constructor({ onMessage, onStateChange } = {}) {
    this.onMessage = onMessage ?? (() => {});
    this.onStateChange = onStateChange ?? (() => {});

    /** @type {EventSource|null} */
    this.source = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this.probeTimer = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this.retryTimer = null;

    this.state = "idle";
    /** Latched once we learn the endpoint does not exist. */
    this.unsupported = false;
    this.retryCount = 0;
    this.lastMessageAt = 0;
  }

  get isOpen() {
    return this.state === "open";
  }

  /** @param {'idle'|'connecting'|'open'|'unsupported'|'error'} next */
  #setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }

  connect() {
    if (this.unsupported || this.source) return;
    if (typeof EventSource === "undefined") {
      this.unsupported = true;
      this.#setState("unsupported");
      return;
    }

    this.#setState("connecting");

    let url;
    try {
      url = liveStreamUrl({ token: getAccessToken() });
    } catch {
      this.unsupported = true;
      this.#setState("unsupported");
      return;
    }

    let source;
    try {
      source = new EventSource(url, { withCredentials: true });
    } catch {
      this.unsupported = true;
      this.#setState("unsupported");
      return;
    }

    this.source = source;

    // Probe window: a healthy server opens the stream quickly. A 404 fires
    // `error` almost immediately, but a proxy that swallows the request would
    // otherwise leave us hanging forever.
    this.probeTimer = setTimeout(() => {
      if (this.state === "connecting") {
        this.#teardown();
        this.unsupported = true;
        this.#setState("unsupported");
      }
    }, PROBE_TIMEOUT_MS);

    source.onopen = () => {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;
      this.retryCount = 0;
      this.#setState("open");
    };

    source.onmessage = (event) => this.#handle(event, "message");

    for (const name of KNOWN_EVENTS) {
      source.addEventListener(name, (event) => this.#handle(event, name));
    }

    source.onerror = () => {
      clearTimeout(this.probeTimer);
      this.probeTimer = null;

      // readyState CLOSED with a non-zero retry means the server said no.
      if (this.state === "connecting") {
        this.#teardown();
        this.unsupported = true;
        this.#setState("unsupported");
        return;
      }

      this.#teardown();
      this.#scheduleReconnect();
    };
  }

  /**
   * @param {MessageEvent} event
   * @param {string} type
   */
  #handle(event, type) {
    this.lastMessageAt = Date.now();
    if (type === "ping") return;

    let payload = event.data;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        return; // ignore malformed frames rather than throwing in the handler
      }
    }
    if (payload && typeof payload === "object" && !type) {
      type = payload.type ?? "message";
    }
    this.onMessage(payload, type);
  }

  #scheduleReconnect() {
    if (this.unsupported) return;
    this.retryCount += 1;
    if (this.retryCount > 5) {
      this.unsupported = true;
      this.#setState("unsupported");
      return;
    }
    const delay = Math.min(1000 * 2 ** (this.retryCount - 1), 15_000);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  #teardown() {
    clearTimeout(this.probeTimer);
    clearTimeout(this.retryTimer);
    this.probeTimer = null;
    this.retryTimer = null;
    if (this.source) {
      this.source.onopen = null;
      this.source.onmessage = null;
      this.source.onerror = null;
      try {
        this.source.close();
      } catch {
        /* already closed */
      }
      this.source = null;
    }
  }

  /** Close the stream but keep the ability to reconnect later. */
  close() {
    this.#teardown();
    this.#setState("idle");
  }

  /** Permanently disable the stream for this session. */
  disable() {
    this.#teardown();
    this.unsupported = true;
    this.#setState("unsupported");
  }

  /** Seconds since the last frame, or null if we have never received one. */
  secondsSinceMessage() {
    if (!this.lastMessageAt) return null;
    return Math.floor((Date.now() - this.lastMessageAt) / 1000);
  }
}
