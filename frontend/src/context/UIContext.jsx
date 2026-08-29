import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState('welcome');
  const [selectedJob, setSelectedJob] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 4500);
  }, [dismissToast]);

  const openCreateJob = useCallback((preset = 'welcome') => {
    setCreatePreset(preset);
    setIsCreateJobOpen(true);
  }, []);

  const closeCreateJob = useCallback(() => setIsCreateJobOpen(false), []);

  const openJobDrawer = useCallback((job) => setSelectedJob(job), []);
  const closeJobDrawer = useCallback(() => setSelectedJob(null), []);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <UIContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        isCreateJobOpen,
        createPreset,
        openCreateJob,
        closeCreateJob,
        selectedJob,
        openJobDrawer,
        closeJobDrawer,
        mobileNavOpen,
        openMobileNav,
        closeMobileNav,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
