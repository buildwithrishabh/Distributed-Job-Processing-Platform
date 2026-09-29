/**
 * Tiny synchronous event bus used to decouple the transport layer from the UI.
 *
 * The API client emits when the session dies, when a request is throttled, or
 * when the queue starts pushing back. React components subscribe through hooks
 * instead of importing the client directly, so a transport change never leaks
 * into the view layer.
 */

/** @typedef {'auth:expired'|'auth:restored'|'throttled'|'backpressure'|'ratelimit'|'config:changed'|'live:changed'} ApiEventName */

class Emitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.channels = new Map();
  }

  /** @param {ApiEventName} name @param {Function} handler */
  on(name, handler) {
    if (!this.channels.has(name)) this.channels.set(name, new Set());
    this.channels.get(name).add(handler);
    return () => this.off(name, handler);
  }

  /** @param {ApiEventName} name @param {Function} handler */
  once(name, handler) {
    const dispose = this.on(name, (payload) => {
      dispose();
      handler(payload);
    });
    return dispose;
  }

  /** @param {ApiEventName} name @param {Function} handler */
  off(name, handler) {
    this.channels.get(name)?.delete(handler);
  }

  /** @param {ApiEventName} name @param {any} [payload] */
  emit(name, payload) {
    const handlers = this.channels.get(name);
    if (!handlers?.size) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[api-events] handler for "${name}" threw:`, error);
      }
    }
  }
}

export const apiEvents = new Emitter();

/**
 * Subscribe to an api event inside a component.
 * @param {ApiEventName} name
 * @param {(payload:any)=>void} handler
 */
export function onApiEvent(name, handler) {
  return apiEvents.on(name, handler);
}
