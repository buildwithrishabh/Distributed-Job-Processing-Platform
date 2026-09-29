import { createContext, useContext, useEffect, useMemo } from "react";

import { useAuth } from "./AuthContext.jsx";
import { useLiveMetrics, useOnlineStatus } from "../lib/hooks/index.js";
import { getHistory, refreshMetrics, startMetrics } from "../lib/live/metricsStore.js";

/**
 * Binds the metrics store to the session.
 *
 * Tracking starts only when authenticated and stops the moment the user signs
 * out, so a signed-out tab never holds an open EventSource or a poll timer
 * against the API.
 */

const LiveContext = createContext(null);

export function LiveProvider({ children }) {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    startMetrics({ enabled: isAuthenticated });
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({ refresh: refreshMetrics, history: getHistory }),
    [],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const context = useContext(LiveContext);
  if (!context) throw new Error("useLive must be used inside <LiveProvider>.");
  return context;
}

/**
 * Live metrics for components. Reads the store through `useSyncExternalStore`
 * and re-renders on every update.
 */
export function useLiveState() {
  return useLiveMetrics((state) => state);
}

export { useOnlineStatus };
