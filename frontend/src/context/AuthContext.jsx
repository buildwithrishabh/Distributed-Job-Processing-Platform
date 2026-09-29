import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { auth } from "../lib/api/endpoints.js";
import { ApiError } from "../lib/api/errors.js";
import { apiEvents } from "../lib/api/events.js";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/api/token.js";
import { stopMetrics } from "../lib/live/metricsStore.js";

/**
 * Authentication state.
 *
 * The session lives in two places at once: an httpOnly cookie the browser
 * manages, and an `Authorization: Bearer` token the transport attaches. Either
 * can be present, and either can disappear (the cookie is dropped over plain
 * HTTP), so `/api/auth/me` is the only thing that decides "am I signed in".
 * The token is just a fast path that avoids a cookie round trip.
 */

const AuthContext = createContext(null);

/** In-flight bootstrap, shared so a StrictMode double-mount makes one call. */
let bootstrapPromise = null;

function normalizeUser(user) {
  if (!user || typeof user !== "object") return null;
  return {
    id: user.id ?? user._id ?? null,
    name: user.name ?? "Developer",
    email: user.email ?? "",
    role: user.role ?? "user",
  };
}

export function AuthProvider({ children }) {
  /** @type {'unknown'|'loading'|'authenticated'|'anonymous'} */
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Ask the server who we are. This is the only authority. */
  const bootstrap = useCallback(async () => {
    if (!getAccessToken()) {
      // No token mirror, but a cookie-only session is still valid on HTTPS.
      // Ask anyway — it is one cheap request and removes a whole class of
      // "stuck on the login screen" bugs.
    }

    if (!bootstrapPromise) {
      bootstrapPromise = auth
        .me()
        .then((data) => {
          const next = normalizeUser(data?.user ?? data);
          if (mountedRef.current) {
            setUser(next);
            setStatus(next ? "authenticated" : "anonymous");
            setError(null);
          }
          return next;
        })
        .catch((caught) => {
          if (caught instanceof ApiError && (caught.kind === "auth" || caught.status === 401)) {
            clearAccessToken();
            if (mountedRef.current) {
              setUser(null);
              setStatus("anonymous");
              setError(null);
            }
            return null;
          }
          // Network failure must NOT be reported as "signed out" — that would
          // make an offline user think their session was revoked.
          if (mountedRef.current) {
            setError(caught);
            setStatus(getAccessToken() ? "authenticated" : "anonymous");
          }
          return null;
        })
        .finally(() => {
          bootstrapPromise = null;
        });
    }
    return bootstrapPromise;
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // The transport broadcasts when a refresh definitively fails. React to it
  // here so protected routes unmount immediately instead of waiting for a 401.
  useEffect(() => {
    const off = apiEvents.on("auth:expired", () => {
      clearAccessToken();
      stopMetrics();
      if (mountedRef.current) {
        setUser(null);
        setStatus("anonymous");
      }
    });
    const offRestored = apiEvents.on("auth:restored", ({ user: restored }) => {
      const next = normalizeUser(restored);
      if (mountedRef.current && next) {
        setUser((prev) => prev ?? next);
        setStatus((prev) => (prev === "anonymous" ? "authenticated" : prev));
      }
    });
    return () => {
      off();
      offRestored();
    };
  }, []);

  const signIn = useCallback(async (credentials) => {
    setError(null);
    const data = await auth.login(credentials);
    const token = data?.accessToken;
    if (token) setAccessToken(token);
    const next = normalizeUser(data?.user);
    setUser(next);
    setStatus("authenticated");
    return next;
  }, []);

  const signUp = useCallback(async (payload) => {
    setError(null);
    const data = await auth.register(payload);
    const token = data?.accessToken;
    if (token) setAccessToken(token);
    const next = normalizeUser(data?.user);
    setUser(next);
    setStatus("authenticated");
    return next;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // The local session must die even if the server call fails.
    }
    clearAccessToken();
    stopMetrics();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      error,
      isAuthenticated: status === "authenticated",
      isLoading: status === "loading",
      signIn,
      signUp,
      signOut,
      refresh: bootstrap,
    }),
    [status, user, error, signIn, signUp, signOut, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
