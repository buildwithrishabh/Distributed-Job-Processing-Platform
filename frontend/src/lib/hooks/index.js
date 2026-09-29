import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { subscribe as subscribeMetrics, getState, refreshMetrics } from "../live/metricsStore.js";
import { lockPageScroll } from "../scrollLock.js";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shallowEqual(a, b) {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.is(a[key], b[key]));
}

/* ==========================================================================
   Data fetching
   ========================================================================== */

/**
 * Run an async function, tracking loading/error state and supporting manual
 * cancellation so a fast filter change cannot write a stale response into
 * state.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fn
 * @param {unknown[]} deps
 * @param {{ immediate?: boolean, initialData?: T, onSuccess?: (data:T)=>void, onError?: (error:any)=>void }} [options]
 */
export function useAsync(fn, deps = [], options = {}) {
  const { immediate = true, initialData = null, onSuccess, onError } = options;

  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const mountedRef = useRef(true);
  const controllerRef = useRef(null);
  const fnRef = useRef(fn);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);

  // Latest-value refs, written after render so render stays side-effect free.
  useEffect(() => {
    fnRef.current = fn;
    successRef.current = onSuccess;
    errorRef.current = onError;
  }, [fn, onSuccess, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fnRef.current(controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return undefined;
      setData(result);
      successRef.current?.(result);
      return result;
    } catch (caught) {
      if (controller.signal.aborted || caught?.kind === "aborted" || !mountedRef.current) {
        return undefined;
      }
      setError(caught);
      errorRef.current?.(caught);
      return undefined;
    } finally {
      if (mountedRef.current && controllerRef.current === controller) {
        setIsLoading(false);
        controllerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (immediate) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const mutate = useCallback((updater) => {
    setData((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  return { data, error, isLoading, execute, mutate, setData };
}

/**
 * Subscribe to the metrics store.
 *
 * The selector is held in a ref and the snapshot is shallow-cached, so a caller
 * can pass an inline arrow function (which is a new function every render)
 * without React's `getSnapshot should be cached` check tearing in a loop.
 * Selectors must return primitives or shallow-comparable objects.
 *
 * @param {(state: ReturnType<typeof getState>) => any} [selector]
 */
export function useLiveMetrics(selector) {
  const selectorRef = useRef(selector);
  const cacheRef = useRef({ value: undefined, primed: false });

  useEffect(() => {
    selectorRef.current = selector;
  });

  const getSnapshot = useCallback(() => {
    const select = selectorRef.current;
    const next = select ? select(getState()) : getState();

    const cached = cacheRef.current;
    if (
      cached.primed &&
      (Object.is(cached.value, next) ||
        (isPlainObject(cached.value) && isPlainObject(next) && shallowEqual(cached.value, next)))
    ) {
      return cached.value;
    }

    cacheRef.current = { value: next, primed: true };
    return next;
  }, []);

  return useSyncExternalStore(subscribeMetrics, getSnapshot, getSnapshot);
}

/* ==========================================================================
   Timing
   ========================================================================== */

/**
 * @template T
 * @param {T} value
 * @param {number} delay
 * @returns {T}
 */
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * @template {(...args:any[])=>void} T
 * @param {T} fn
 * @param {number} [delay]
 */
export function useDebouncedCallback(fn, delay = 250) {
  const timerRef = useRef(null);
  const fnRef = useRef(fn);

  // Keep the latest callback without re-creating the debounced wrapper. Written
  // in an effect so the ref is not mutated during render.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useCallback(
    (...args) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}

/**
 * Re-render on an interval. Used for "x seconds ago" labels and countdowns.
 * @param {number} ms
 */
export function useTicker(ms = 1000, enabled = true) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [ms, enabled]);
}

/* ==========================================================================
   Environment
   ========================================================================== */

/**
 * @param {string} query
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", handler);
    return () => list.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1025px)");
}

export function usePrefersReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/* ==========================================================================
   Interaction
   ========================================================================== */

/**
 * Close on Escape, trap Tab focus inside the node, and restore focus to the
 * element that opened it. The three things a custom dialog must do and the
 * three that are almost always forgotten.
 *
 * @param {boolean} active
 * @param {{ onEscape?: () => void, initialFocusRef?: import('react').RefObject<HTMLElement>, lockScroll?: boolean }} [options]
 */
export function useFocusTrap(active, { onEscape, initialFocusRef, lockScroll = true } = {}) {
  const containerRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    restoreRef.current = document.activeElement;

    const container = containerRef.current;
    if (container) {
      const target =
        initialFocusRef?.current ??
        container.querySelector(
          '[data-autofocus], input:not([type="hidden"]):not([disabled]), textarea, select, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
      // Defer so the element exists after the open animation frame.
      requestAnimationFrame(() => target?.focus());
    }

    const previouslyFocused = restoreRef.current;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;

      const focusable = [
        ...containerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const unlockScroll = lockScroll ? lockPageScroll() : null;

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      unlockScroll?.();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [active, onEscape, initialFocusRef, lockScroll]);

  return containerRef;
}

/**
 * @param {boolean} active
 * @param {(event: MouseEvent|TouchEvent) => void} handler
 */
export function useDismissable(active, handler) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (event) => {
      if (event.target instanceof Element && event.target.closest("[data-popover-root]")) return;
      handlerRef.current(event);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [active]);
}

/* ==========================================================================
   Storage
   ========================================================================== */

/**
 * @template T
 * @param {string} key
 * @param {T} initialValue
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* quota or private mode */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}

/* ==========================================================================
   Collection helpers
   ========================================================================== */

/**
 * Close a dropdown when focus leaves its subtree.
 * @param {boolean} active
 * @param {import('react').RefObject<HTMLElement>} ref
 */
export function useCloseOnBlur(active, ref) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        ref.current.dispatchEvent(new CustomEvent("close-popover", { bubbles: false }));
      }
    };
    const timer = setTimeout(() => document.addEventListener("focusin", handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", handler);
    };
  }, [active, ref]);
}

/** Re-render when the browser goes offline/online. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export { refreshMetrics };
