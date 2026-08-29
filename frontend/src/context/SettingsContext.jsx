import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const SettingsContext = createContext(null);

const DEFAULT_INTERVAL = 5000;

function readStoredInterval() {
  const stored = localStorage.getItem('settings:refreshInterval');
  const parsed = stored !== null ? Number(stored) : DEFAULT_INTERVAL;
  return Number.isNaN(parsed) ? DEFAULT_INTERVAL : parsed;
}

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('settings:theme') || 'light');
  const [refreshInterval, setRefreshIntervalState] = useState(readStoredInterval);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('settings:theme', theme);
  }, [theme]);

  const setRefreshInterval = useCallback((ms) => {
    setRefreshIntervalState(ms);
    localStorage.setItem('settings:refreshInterval', String(ms));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <SettingsContext.Provider
      value={{ theme, toggleTheme, refreshInterval, setRefreshInterval }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}