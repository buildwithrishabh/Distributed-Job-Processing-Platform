import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { storeSession, clearSession, getStoredUser, decodeUserFromToken, isAuthError } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  // Re-validate the cached session once on load against a real authed endpoint.
  // No GET /me exists on the backend, so a lightweight /jobs probe is used as a
  // liveness check; the response interceptor silently rotates tokens via the
  // httpOnly refreshToken cookie before the request is replayed.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Always probe: a valid session may exist purely via httpOnly cookies even
      // when localStorage is empty (e.g. after clearing site data).
      try {
        await api.get('/jobs', { params: { limit: 1 } });
        if (cancelled) return;
        const fresh = getStoredUser();
        setUser(fresh || decodeUserFromToken() || { name: 'User' });
        setStatus('authenticated');
      } catch (err) {
        if (cancelled) return;
        if (isAuthError(err)) {
          // Interceptor already tried a silent refresh; session is invalid.
          clearSession();
        }
        setUser(null);
        setStatus('anonymous');
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Global signal from the api layer whenever any request lands on a hard 401.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const res = await api.post('/auth/login', { email, password });
    const data = res.data;
    storeSession({ accessToken: data.accessToken, user: data.user });
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const res = await api.post('/auth/register', { name, email, password });
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Cookies are cleared best-effort; always drop the local session.
    }
    clearSession();
    setUser(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isAuthenticated: status === 'authenticated',
        isAuthLoading: status === 'loading',
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}