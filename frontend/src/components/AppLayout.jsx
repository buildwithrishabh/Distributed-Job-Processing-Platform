import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Cpu,
  LayoutDashboard,
  Layers,
  AlertOctagon,
  Server,
  Plus,
  LogOut,
  Sun,
  Moon,
  Menu,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUI } from '../context/UIContext';
import { useHealthQuery, useOverviewQuery } from '../hooks/useQueries';
import { ToastStack } from './ui';
import CreateJobModal from './CreateJobModal';
import JobDetailDrawer from './JobDetailDrawer';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/jobs', label: 'Jobs Queue', icon: Layers },
  { to: '/dlq', label: 'Dead Letter', icon: AlertOctagon },
  { to: '/workers', label: 'Worker Pool', icon: Server },
];

const INTERVALS = [
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
  { value: 0, label: 'Paused' },
];

const PAGE_META = {
  '/': { title: 'Overview', sub: 'Live operations & queue metrics' },
  '/jobs': { title: 'Jobs Queue', sub: 'Browse, filter & manage enqueued jobs' },
  '/dlq': { title: 'Dead Letter Queue', sub: 'Audit and recover jobs that failed retries' },
  '/workers': { title: 'Worker Pool', sub: 'Monitor cluster consumers & telemetry' },
};

export default function AppLayout() {
  const { user, logout, status } = useAuth();
  const { theme, toggleTheme, refreshInterval, setRefreshInterval } = useSettings();
  const {
    toasts,
    dismissToast,
    isCreateJobOpen,
    closeCreateJob,
    selectedJob,
    closeJobDrawer,
    mobileNavOpen,
    openMobileNav,
    closeMobileNav,
    openCreateJob,
  } = useUI();

  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META['/'];

  const { data: health, isError, isLoading } = useHealthQuery();
  const { data: overview } = useOverviewQuery();
  const deadCount = overview?.jobs?.DEAD ?? overview?.jobs?.FAILED ?? 0;

  const isConnecting = isLoading && !health;
  const isOnline = health?.status === 'OK' && !isError;

  const healthLabel = isConnecting ? 'CONNECTING' : isOnline ? 'API ONLINE' : 'DISCONNECTED';
  const healthCls = isConnecting ? 'connecting' : isOnline ? 'online' : 'offline';

  const NavItems = (
    <>
      <div className="nav-label">Workspace</div>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={closeMobileNav}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={18} className="nav-ico" />
          <span>{label}</span>
          {to === '/dlq' && deadCount > 0 && <span className="nav-badge">{deadCount}</span>}
        </NavLink>
      ))}
      <div className="nav-label">Telemetry</div>
      <div className={`health-strip ${healthCls}`}>
        <span className={`pulse-dot ${isOnline ? '' : 'offline'}`} />
        <div>
          <div className="health-label">{healthLabel}</div>
          <div className="h-strip-sub">BullMQ &middot; Redis &middot; Mongo</div>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <button
        className="btn btn-secondary btn-icon mobile-menu-btn"
        onClick={openMobileNav}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {mobileNavOpen && <div className="sidebar-backdrop" onClick={closeMobileNav} />}
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Cpu size={22} />
          </div>
          <div className="brand-words">
            <div className="brand-title">JobOrchestrator</div>
            <div className="brand-subtitle">Queue & Worker Control</div>
          </div>
        </div>

        <nav className="sidebar-nav">{NavItems}</nav>

        <div className="sidebar-footer">
          <div className="refresh-control">
            <span className="refresh-label">
              <RefreshCw size={13} className={refreshInterval > 0 ? 'spin-icon' : ''} /> Live Refresh
            </span>
            <select
              className="form-select refresh-select"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              {INTERVALS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="faint" style={{ marginTop: '0.9rem', fontSize: '0.68rem', textAlign: 'center' }}>
            JobOrchestrator v1.0 &middot; Node · Redis · MongoDB
          </div>
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{meta.title}</h1>
            <p>{meta.sub}</p>
          </div>

          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="btn btn-primary btn-sm dispatch-btn" onClick={() => openCreateJob('welcome')}>
              <Plus size={16} /> <span className="dispatch-text">Dispatch Job</span>
            </button>
            {user && status === 'authenticated' && (
              <div className="user-chip" title={user.email}>
                <span className="avatar">{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
                <span className="user-name-wrap">
                  <span className="user-name">{user.name || 'User'}</span>
                </span>
              </div>
            )}
            <button className="icon-btn" onClick={logout} title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="page-wrap">
          <Outlet />
        </main>
      </div>

      {isCreateJobOpen && <CreateJobModal isOpen onClose={closeCreateJob} />}
      <JobDetailDrawer job={selectedJob} onClose={closeJobDrawer} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
