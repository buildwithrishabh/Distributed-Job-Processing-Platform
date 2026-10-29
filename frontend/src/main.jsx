import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  LoaderCircle,
  LogOut,
  Menu,
  RefreshCw,
  X,
} from "lucide-react";
import { api } from "./api";
import { nav, shortId } from "./utils";
import { MobileDesktopOnlyNotice } from "./components/Common";
import { AuthScreen } from "./components/AuthScreen";
import { HelpSupportPage } from "./components/HelpSupportPage";
import { OverviewView } from "./components/OverviewView";
import { JobsView } from "./components/JobsView";
import { DeadJobsView } from "./components/DeadJobsView";
import { WorkerTelemetry } from "./components/WorkerTelemetry";
import { JobSubmitModal } from "./components/JobSubmitModal";
import { JobDetailModal } from "./components/JobDetailModal";
import { SocketProvider, useSocket } from "./context/SocketContext";
import "./styles.css";

function DashboardShell({ user, onSignOut }) {
  const [page, setPage] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { socket, isConnected, connectionError } = useSocket();

  const notify = useCallback((message, kind = "success") => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  // Global ESC key listener to close modal drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (createOpen) setCreateOpen(false);
        else if (detail) setDetail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createOpen, detail]);

  // Global background notifications for terminal job events.
  // Fix #6: skip the toast if the detail modal is already open for that job —
  // the user can see the status change in real time inside the drawer, so a
  // redundant toast would be noise.
  useEffect(() => {
    if (!socket) return;

    const handleGlobalJobUpdate = (payload) => {
      if (detail === payload.jobId) return;

      if (payload.status === "COMPLETED") {
        notify(`Job ${shortId(payload.jobId)} completed successfully`, "success");
      } else if (payload.status === "FAILED" || payload.status === "DEAD") {
        notify(`Job ${shortId(payload.jobId)} failed: ${payload.error || "Execution error"}`, "error");
      }
    };

    socket.on("job:updated", handleGlobalJobUpdate);
    return () => {
      socket.off("job:updated", handleGlobalJobUpdate);
    };
  }, [socket, notify, detail]);

  const current = nav.find((item) => item.id === page);
  const pageTitle = page === "docs" ? "Help & support" : current?.label;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">Q</div>
          <span>
            queue<span className="brand-dot">.</span>
          </span>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={17} />
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-icon">
            {user.name?.slice(0, 1)?.toUpperCase() || "W"}
          </div>
          <div className="workspace-copy">
            <strong>{user.name || "Workspace"}</strong>
            <span>Personal workspace</span>
          </div>
          <ChevronDown size={14} className="muted" />
        </div>

        <div className="nav-caption">PLATFORM</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${page === id ? "selected" : ""}`}
              onClick={() => {
                setPage(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div
            className="api-chip"
            title={
              isConnected
                ? "Real-time WebSocket connected"
                : connectionError === "auth"
                ? "Authentication error — please sign out and sign back in"
                : "Reconnecting to WebSocket server..."
            }
          >
            <span className={`live-dot ${isConnected ? "connected" : "disconnected"}`} />
            {isConnected ? "Live (WebSocket)" : connectionError === "auth" ? "Auth Error" : "Connecting..."}{" "}
            <span className="api-chip-right">v1</span>
          </div>
          <button
            className={`nav-link ${page === "docs" ? "selected" : ""}`}
            onClick={() => {
              setPage("docs");
              setMobileOpen(false);
            }}
          >
            <CircleHelp size={16} />
            <span>Help &amp; support</span>
            <BookOpen size={13} className="nav-end" />
          </button>
          <div className="account">
            <div className="avatar">
              {user.name?.slice(0, 1)?.toUpperCase()}
            </div>
            <div className="account-copy">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button title="Sign out" className="icon-button" onClick={onSignOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="top-actions">
            <span
              className="environment"
              title={
                isConnected
                  ? "Real-time WebSocket connected"
                  : connectionError === "auth"
                  ? "Authentication error — please sign out and sign back in"
                  : "WebSocket disconnected"
              }
            >
              <span className={`live-dot ${isConnected ? "connected" : "disconnected"}`} />
              {isConnected ? "Live" : connectionError === "auth" ? "Auth Error" : "Offline"}
            </span>
            <span className="top-separator" />
            <button
              className="icon-button"
              title="Refresh data"
              onClick={() => setRefreshKey((v) => v + 1)}
            >
              <RefreshCw size={15} />
            </button>
            <span className="user-mini" aria-label={`${user.name} account`}>
              {user.name?.slice(0, 1)?.toUpperCase()}
            </span>
          </div>
        </header>

        <div className="content">
          {page === "overview" && (
            <OverviewView
              key={refreshKey}
              onNavigate={setPage}
              onCreate={() => setCreateOpen(true)}
              onSelectJob={setDetail}
            />
          )}
          {page === "jobs" && (
            <JobsView
              key={`jobs-${refreshKey}`}
              onSelectJob={setDetail}
              onCreate={() => setCreateOpen(true)}
              notify={notify}
            />
          )}
          {page === "dead" && (
            <DeadJobsView
              key={`dead-${refreshKey}`}
              onSelectJob={setDetail}
              notify={notify}
            />
          )}
          {page === "workers" && <WorkerTelemetry key={`workers-${refreshKey}`} />}
          {page === "docs" && (
            <HelpSupportPage
              onNavigate={setPage}
              onCreate={() => setCreateOpen(true)}
              notify={notify}
            />
          )}
        </div>
      </main>

      {detail && (
        <JobDetailModal
          id={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setRefreshKey((v) => v + 1);
          }}
          notify={notify}
        />
      )}

      {createOpen && (
        <JobSubmitModal
          onClose={() => setCreateOpen(false)}
          onCreated={(job) => {
            setCreateOpen(false);
            setPage("jobs");
            setRefreshKey((v) => v + 1);
            notify(`Job ${job.jobId} submitted.`);
          }}
        />
      )}

      {notice && (
        <div className={`toast ${notice.kind}`}>
          <span>
            {notice.kind === "success" ? (
              <Check size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
          </span>
          {notice.message}
          <button className="icon-button" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileScreen, setIsMobileScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth < 860 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 860);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  if (isMobileScreen) {
    return <MobileDesktopOnlyNotice />;
  }

  if (authChecking) {
    return (
      <div className="splash">
        <div className="brand-mark">Q</div>
        <LoaderCircle className="spin" size={18} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={setUser} notify={() => {}} />;
  }

  return (
    <SocketProvider user={user}>
      <DashboardShell user={user} onSignOut={signOut} />
    </SocketProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
