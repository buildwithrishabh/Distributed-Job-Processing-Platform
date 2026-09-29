import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { apiEvents } from "../lib/api/events.js";
import { Toast } from "../components/ui/Toast.jsx";

/**
 * Toast notifications.
 *
 * Rate-limit and back-pressure notices are raised by the transport, not by any
 * component, so this subscribes to the event bus. That keeps a 429 response
 * from surfacing only if some screen happened to be listening.
 */

const ToastContext = createContext(null);

const DEFAULT_DURATION = 6_000;
const MAX_VISIBLE = 4;

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [region, setRegion] = useState("live");
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      counter += 1;
      const id = `t${counter}`;
      const entry = {
        id,
        tone: "neutral",
        title: "",
        description: null,
        duration: DEFAULT_DURATION,
        ...toast,
      };

      setToasts((prev) => {
        // Collapse duplicates: three 429s in a row should not stack.
        if (entry.dedupeKey) {
          const existing = prev.find((t) => t.dedupeKey === entry.dedupeKey);
          if (existing) {
            return prev.map((t) => (t.id === existing.id ? { ...entry, id: existing.id } : t));
          }
        }
        const next = [...prev, entry];
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });

      if (entry.duration !== Infinity) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), entry.duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Transport-level notifications.
  useEffect(() => {
    const offThrottled = apiEvents.on("throttled", (payload) => {
      push({
        tone: payload.kind === "backpressure" ? "danger" : "warn",
        title: payload.kind === "backpressure" ? "Queue at capacity" : "Rate limit reached",
        description: payload.message,
        duration: Math.max(5_000, (payload.retryAfter ?? 30) * 1000),
        dedupeKey: payload.kind,
      });
    });
    const offExpired = apiEvents.on("auth:expired", () => {
      push({
        tone: "warn",
        title: "Session ended",
        description: "Sign in again to continue.",
        dedupeKey: "auth:expired",
      });
    });
    return () => {
      offThrottled();
      offExpired();
    };
  }, [push]);

  const value = useMemo(
    () => ({
      toasts,
      push,
      dismiss,
      success: (title, description) => push({ tone: "success", title, description }),
      warning: (title, description) => push({ tone: "warning", title, description, duration: 9_000 }),
      error: (title, description) => push({ tone: "danger", title, description, duration: 9_000 }),
      info: (title, description) => push({ tone: "neutral", title, description }),
      announce: setRegion,
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-region"
        data-region={region}
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
