import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiEvents } from "../lib/api/events.js";
import { describeOrigin, readStoredOrigin, resolveOrigin, validateOrigin, writeStoredOrigin } from "../lib/api/url.js";
import { probeRuntimeConfig, resolveConfig, SOURCE_LABEL } from "../lib/runtime/capabilities.js";

/**
 * Runtime configuration + API endpoint selection.
 *
 * The console needs to know the real `MAX_QUEUE_CAPACITY` and worker
 * concurrency. The backend does not publish either, so instead of hardcoding a
 * number (the previous UI claimed 1000 while the server ran 50000) we:
 *   1. probe an optional `/api/config`
 *   2. fall back to `VITE_*` build values
 *   3. fall back to a clearly-labelled default
 *
 * `source` travels with the value so the UI can say where it came from rather
 * than implying the API confirmed it.
 */

const ConfigContext = createContext(null);

const THEME_KEY = "njq.theme";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function ConfigProvider({ children }) {
  const [origin, setOriginState] = useState(() => readStoredOrigin() ?? resolveOrigin());
  const [config, setConfig] = useState(() => resolveConfig());
  const [apiConfigAvailable, setApiConfigAvailable] = useState(null);
  const [theme, setThemeState] = useState(readStoredTheme);

  const applyTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    }
  }, []);

  // Apply the initial theme before paint.
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setOrigin = useCallback(
    (next) => {
      const result = validateOrigin(next);
      if (!result.ok) return result;
      writeStoredOrigin(result.origin);
      setOriginState(result.origin);
      apiEvents.emit("config:changed", { origin: result.origin });
      return { ok: true, origin: result.origin };
    },
    [],
  );

  const resetOrigin = useCallback(() => {
    writeStoredOrigin(null);
    setOriginState(resolveOrigin());
    apiEvents.emit("config:changed", {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  // Probe the optional config endpoint whenever the endpoint changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { config: fromApi, available } = await probeRuntimeConfig();
      if (cancelled) return;
      setApiConfigAvailable(available);
      if (available && fromApi) {
        setConfig(
          resolveConfigFromApi(fromApi) ?? resolveConfig(),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin]);

  const value = useMemo(
    () => ({
      origin,
      originLabel: describeOrigin(origin),
      setOrigin,
      resetOrigin,
      config,
      apiConfigAvailable,
      sourceLabel: SOURCE_LABEL,
      theme,
      setTheme: applyTheme,
      toggleTheme,
    }),
    [origin, setOrigin, resetOrigin, config, apiConfigAvailable, theme, applyTheme, toggleTheme],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** Overlay API-provided values on top of the env/default resolution. */
function resolveConfigFromApi(fromApi) {
  const base = resolveConfig();
  try {
    if (fromApi && typeof fromApi === "object") {
      const merged = { ...fromApi };
      return { ...base, ...merged };
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error("useConfig must be used inside <ConfigProvider>.");
  return context;
}
