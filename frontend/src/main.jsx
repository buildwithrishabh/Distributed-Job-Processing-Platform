import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  BookOpen,
  CircleHelp,
  Clock3,
  Copy,
  Cpu,
  Laptop,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "./api";
import { HelpSupportPage } from "./components/HelpSupportPage";
import "./styles.css";

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "dead", label: "Dead letter queue", icon: AlertCircle },
  { id: "workers", label: "Workers", icon: Cpu },
];

const statuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "RETRYING",
  "DEAD",
  "CANCELLED",
];

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const shortId = (value = "") =>
  value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-5)}` : value;

const errorText = (error) =>
  error?.details?.map((item) => `${item.field}: ${item.message}`).join(" · ") ||
  error?.message ||
  "Something went wrong.";

function MobileDesktopOnlyNotice() {
  return (
    <div className="mobile-gate-overlay">
      <div className="mobile-gate-card">
        <div className="mobile-gate-icon-box">
          <Laptop size={32} strokeWidth={1.8} />
        </div>
        <h2 className="mobile-gate-title">Desktop experience required</h2>
        <p className="mobile-gate-subtitle">
          Please open this dashboard on a laptop or desktop screen. The distributed queue
          and worker console is optimized for larger displays.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [page, setPage] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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

  const notify = useCallback((message, kind = "success") => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 4500);
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

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setPage("overview");
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
    return <AuthScreen onLogin={setUser} notify={notify} />;
  }

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
          <div className="api-chip">
            <span className="live-dot" /> Authenticated{" "}
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
            <button title="Sign out" className="icon-button" onClick={signOut}>
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
            <span className="environment">
              <span className="live-dot" /> Authenticated
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
            <Overview
              key={refreshKey}
              onNavigate={setPage}
              onCreate={() => setCreateOpen(true)}
              onSelectJob={setDetail}
            />
          )}
          {page === "jobs" && (
            <Jobs
              key={`jobs-${refreshKey}`}
              onSelectJob={setDetail}
              onCreate={() => setCreateOpen(true)}
              notify={notify}
            />
          )}
          {page === "dead" && (
            <DeadJobs
              key={`dead-${refreshKey}`}
              onSelectJob={setDetail}
              notify={notify}
            />
          )}
          {page === "workers" && <Workers key={`workers-${refreshKey}`} />}
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
        <JobDetail
          id={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setDetail(null);
            setRefreshKey((v) => v + 1);
          }}
          notify={notify}
        />
      )}

      {createOpen && (
        <CreateJob
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

function AuthScreen({ onLogin, notify }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "register") {
        await api.register(
          form.get("name"),
          form.get("email"),
          form.get("password")
        );
        notify("Account created. Sign in to continue.");
        setMode("login");
      } else {
        const data = await api.login(form.get("email"), form.get("password"));
        onLogin(data.user);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">Q</div>
        <span>
          queue<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="auth-card">
        <div className="auth-eyebrow">DISTRIBUTED JOB PLATFORM</div>
        <h1>{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <p>
          {mode === "login"
            ? "Sign in to manage and monitor background jobs."
            : "Set up your workspace to process jobs at scale."}
        </p>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && (
            <Field label="Full name">
              <input
                name="name"
                autoComplete="name"
                placeholder="Alex Developer"
                required
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="alex@example.com"
              required
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              placeholder="••••••••"
              required
            />
          </Field>
          {error && <InlineError>{error}</InlineError>}
          <button className="button primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? "New to Queue?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>
      <div className="auth-footer">Secure access · HTTP-only session cookies</div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function DocsPage({ onNavigate, onCreate, notify }) {
  return (
    <HelpSupportPage
      onNavigate={onNavigate}
      onCreate={onCreate}
      notify={notify}
    />
  );
}

function Overview({ onNavigate, onCreate, onSelectJob }) {
  const [data, setData] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return Promise.all([api.overview(), api.jobs(1, 6)])
      .then(([overview, list]) => {
        setData(overview);
        setJobs(list);
        setError("");
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (error && !data) {
    return (
      <>
        <PageHeading
          eyebrow="OVERVIEW"
          title="Dashboard"
          description="A live view of your distributed background job queue."
          action={
            <button className="button primary" onClick={onCreate}>
              <Plus size={16} /> Create job
            </button>
          }
        />
        <ErrorPanel message={error} onRetry={load} />
      </>
    );
  }

  const stats = data?.jobs;
  const queue = data?.queue;
  const latest = jobs?.jobs || [];

  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Dashboard"
        description="A live view of your distributed background job queue."
        action={
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create job
          </button>
        }
      />
      <div className="metric-grid">
        {[
          {
            label: "Total jobs",
            value: stats?.total,
            icon: Activity,
            note: "Across your workspace",
          },
          {
            label: "In progress",
            value:
              (stats?.PENDING || 0) +
              (stats?.PROCESSING || 0) +
              (stats?.RETRYING || 0),
            icon: Clock3,
            note: `${stats?.PROCESSING || 0} currently processing`,
          },
          {
            label: "Completed",
            value: stats?.COMPLETED,
            icon: Check,
            note: "Successfully executed",
          },
          {
            label: "Dead letter",
            value: stats?.DEAD,
            icon: AlertCircle,
            note: "Jobs that exhausted their retries",
          },
        ].map((item) => (
          <Metric key={item.label} {...item} />
        ))}
      </div>

      <div className="overview-grid">
        <section className="panel queue-panel">
          <PanelTitle
            title="Queue activity"
            subtitle={queue?.queueName || "job-queue"}
            action={
              <span className="live-label">
                <span className="live-dot" /> Live
              </span>
            }
          />
          <div className="queue-main">
            <div className="queue-big">
              <span>{queue?.waiting ?? "—"}</span>
              <small>Waiting to be processed</small>
            </div>
            <div className="queue-mini">
              <span>
                <i className="legend-dot white" /> Active{" "}
                <b>{queue?.active ?? "—"}</b>
              </span>
              <span>
                <i className="legend-dot" /> Delayed{" "}
                <b>{queue?.delayed ?? "—"}</b>
              </span>
            </div>
          </div>
          <div className="queue-bottom">
            <span>Jobs currently tracked in Redis</span>
            <b>{queue?.totalInMemory ?? "—"} total</b>
          </div>
        </section>

        <section className="panel workers-panel">
          <PanelTitle
            title="Workers"
            subtitle="Distributed background workers"
            action={
              <button
                className="text-button"
                onClick={() => onNavigate("workers")}
              >
                View workers <ArrowRight size={14} />
              </button>
            }
          />
          <div className="worker-summary">
            <div className="worker-count">
              <Server size={18} />
              <strong>{data?.workers?.activeWorkerCount ?? "—"}</strong>
              <span>active workers</span>
            </div>
            <div className="worker-spark">
              <Activity size={38} strokeWidth={1.3} />
              <span>Heartbeat sync</span>
            </div>
          </div>
          <div className="queue-bottom">
            <span>Cluster status</span>
            <span className="health-pill">
              <span className="live-dot" />
              {data?.workers?.activeWorkerCount ? "Workers active" : "No active workers"}
            </span>
          </div>
        </section>
      </div>

      <section className="panel recent-panel">
        <PanelTitle
          title="Recent jobs"
          subtitle="The latest jobs processed by your cluster"
          action={
            <button className="text-button" onClick={() => onNavigate("jobs")}>
              View all jobs <ArrowRight size={14} />
            </button>
          }
        />
        <JobsTable
          jobs={latest}
          loading={!jobs}
          onSelect={onSelectJob}
          empty="No jobs have been submitted yet."
          emptyDescription="Create your first job to see its status and processing details here."
        />
      </section>
    </>
  );
}

function Metric({ label, value, icon: Icon, note }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="metric-value">
        {value ?? <span className="skeleton inline" />}
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function PanelTitle({ title, subtitle, action }) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

function Jobs({ onSelectJob, onCreate, notify }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .jobs(page, 10, status)
      .then(setData)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 10)));

  const retry = async (event, id) => {
    event.stopPropagation();
    setRetryingId(id);
    try {
      await api.retryJob(id);
      notify("Job re-queued for processing.");
      load();
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setRetryingId("");
    }
  };

  const filteredJobs = (data?.jobs || []).filter((j) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      j.jobId?.toLowerCase().includes(q) ||
      j.type?.toLowerCase().includes(q) ||
      j.payload?.to?.toLowerCase().includes(q) ||
      j.payload?.subject?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeading
        eyebrow="QUEUE"
        title="Jobs"
        description="Inspect, filter, and manage distributed jobs in real-time."
        action={
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create job
          </button>
        }
      />
      <section className="panel list-panel">
        <div className="list-toolbar">
          <div className="search-input-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search this page by ID or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                style={{ width: 20, height: 20 }}
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <StatusDropdown
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />

          <div className="toolbar-right">
            <span>
              {data
                ? search.trim()
                  ? `${filteredJobs.length} shown on this page · ${data.total} total`
                  : `${data.total} jobs`
                : "Loading jobs"}
            </span>
            {(search || status) && (
              <button
                className="text-button clear-filters"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
            <button
              className="icon-button bordered"
              onClick={load}
              title="Refresh"
              aria-label="Refresh jobs"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <JobsTable
            jobs={filteredJobs}
            loading={loading}
            onSelect={onSelectJob}
            empty="No jobs match your filter criteria."
            emptyDescription={
              data?.total
                ? "Try a different search or status, or clear the current filters."
                : "Create a job to see it appear here."
            }
            action={(job) =>
              ["FAILED", "DEAD"].includes(job.status) ? (
                <button
                  className="button small"
                  disabled={retryingId === job.jobId}
                  onClick={(e) => retry(e, job.jobId)}
                >
                  {retryingId === job.jobId ? (
                    <LoaderCircle size={12} className="spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}{" "}
                  {retryingId === job.jobId ? "Retrying" : "Retry"}
                </button>
              ) : (
                <span className="priority">{job.priority ?? 0}</span>
              )
            }
          />
        )}
        <Pagination
          page={page}
          pages={pages}
          total={data?.total || 0}
          limit={data?.limit || 10}
          onChange={setPage}
        />
      </section>
      <p className="footnote">
        <Shield size={13} /> Multi-tenant isolated queue. Cancel pending jobs or
        retry failed items with idempotency protection.
      </p>
    </>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses", desc: "Show all queued & processed jobs" },
  { value: "PENDING", label: "PENDING", desc: "Waiting in queue to be picked up" },
  { value: "PROCESSING", label: "PROCESSING", desc: "Actively executing on a worker" },
  { value: "COMPLETED", label: "COMPLETED", desc: "Executed successfully without errors" },
  { value: "FAILED", label: "FAILED", desc: "Encountered execution failure" },
  { value: "RETRYING", label: "RETRYING", desc: "Waiting for exponential retry" },
  { value: "DEAD", label: "DEAD", desc: "Moved to dead-letter queue" },
  { value: "CANCELLED", label: "CANCELLED", desc: "Aborted or cancelled by user" },
];

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedConfig =
    STATUS_OPTIONS.find((item) => item.value === value) || STATUS_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!dropdownRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      const activeEl = optionRefs.current[activeIndex];
      if (activeEl) {
        activeEl.focus();
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [open, activeIndex]);

  const openAtSelection = () => {
    const selectedIndex = STATUS_OPTIONS.findIndex((item) => item.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange("");
    dropdownRef.current?.querySelector(".status-select-trigger")?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openAtSelection();
    }
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index + direction + STATUS_OPTIONS.length) % STATUS_OPTIONS.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : STATUS_OPTIONS.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      dropdownRef.current?.querySelector(".status-select-trigger")?.focus();
    }
  };

  return (
    <div className="filter-label status-filter">
      <span>Status</span>
      <div className="status-dropdown" ref={dropdownRef}>
        <button
          type="button"
          className={`status-select-trigger ${value ? "is-active" : ""} ${open ? "is-open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Filter jobs by status. Current selection: ${selectedConfig.label}`}
          onClick={() => (open ? setOpen(false) : openAtSelection())}
          onKeyDown={handleTriggerKeyDown}
        >
          <div className="status-trigger-main">
            <span
              className={`status-indicator-dot dot-${(value || "all").toLowerCase()}`}
              aria-hidden="true"
            />
            <span className="status-trigger-text">{selectedConfig.label}</span>
          </div>

          <div className="status-trigger-right">
            {value && (
              <span
                role="button"
                tabIndex={0}
                className="status-clear-trigger-btn"
                title="Clear status filter"
                aria-label="Clear status filter"
                onClick={clearSelection}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    clearSelection(e);
                  }
                }}
              >
                <X size={12} aria-hidden="true" />
              </span>
            )}
            <ChevronDown size={14} className="status-chevron" aria-hidden="true" />
          </div>
        </button>

        {open && (
          <div className="status-options" role="listbox" aria-label="Job status">
            <div className="status-options-header">
              <span>Filter by status</span>
              {value && (
                <button
                  type="button"
                  className="status-options-reset-link"
                  onClick={() => choose("")}
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="status-options-body">
              {STATUS_OPTIONS.map((item, index) => {
                const isSelected = value === item.value;
                const isAll = item.value === "";
                return (
                  <div key={item.value || "all"}>
                    <button
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`status-option ${isSelected ? "selected" : ""}`}
                      onClick={() => choose(item.value)}
                      onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    >
                      <div className="status-option-left">
                        <span
                          className={`status-indicator-dot dot-${(item.value || "all").toLowerCase()}`}
                          aria-hidden="true"
                        />
                        <div className="status-option-text-group">
                          <span className="status-option-title">{item.label}</span>
                          <span className="status-option-subtitle">{item.desc}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={14} className="status-option-check" aria-hidden="true" />
                      )}
                    </button>
                    {isAll && <div className="status-options-separator" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeadJobs({ onSelectJob, notify }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .deadJobs(page, 10)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(event, id) {
    event.stopPropagation();
    setBusy(id);
    try {
      await api.retryJob(id);
      notify("Job re-queued for processing.");
      load();
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy("");
    }
  }

  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 10)));

  return (
    <>
      <PageHeading
        eyebrow="RECOVERY"
        title="Dead letter queue"
        description="Review jobs that exhausted retries or failed permanently."
      />
      <section className="panel list-panel">
        <div className="list-toolbar">
          <div className="dlq-note">
            <AlertCircle size={15} />
            <span>Dead jobs can be safely re-queued for another attempt.</span>
          </div>
          <div className="toolbar-right">
            <span>
              {data ? `${data.total} dead jobs` : "Loading"}
              <button className="icon-button bordered" onClick={load}>
                <RefreshCw size={14} />
              </button>
            </span>
          </div>
        </div>
        {error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <JobsTable
            jobs={data?.jobs || []}
            loading={loading}
            onSelect={onSelectJob}
            empty="Your dead letter queue is empty."
            emptyDescription="Jobs appear here after their retries are exhausted or they fail permanently."
            action={(job) => (
              <button
                className="button small"
                disabled={busy === job.jobId}
                onClick={(e) => retry(e, job.jobId)}
              >
                {busy === job.jobId ? (
                  <LoaderCircle size={12} className="spin" />
                ) : (
                  <RefreshCw size={12} />
                )}{" "}
                Retry
              </button>
            )}
          />
        )}
        <Pagination
          page={page}
          pages={pages}
          total={data?.total || 0}
          limit={data?.limit || 10}
          onChange={setPage}
        />
      </section>
      <p className="footnote">
        <Shield size={13} /> Retrying resets attempts and returns the job to
        pending in Redis.
      </p>
    </>
  );
}

function Workers() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () => api.workers().then((result) => {
      setData(result);
      setError("");
    }).catch((e) => setError(errorText(e))),
    []
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <PageHeading
        eyebrow="INFRASTRUCTURE"
        title="Workers"
        description="Live heartbeat telemetry reported by worker instances."
        action={
          <button className="button secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : (
        <section className="panel list-panel">
          <div className="workers-heading">
            <div>
              <span className="metric-value">
                {data?.activeWorkerCount ?? "—"}
              </span>
              <span className="workers-caption">active workers</span>
            </div>
            <span className="live-label">
              <span className="live-dot" /> Auto-sync · 15s
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>WORKER</th>
                  <th>STATUS</th>
                  <th>HEALTH</th>
                  <th>UPTIME</th>
                  <th>MEMORY</th>
                  <th>LAST SEEN</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr>
                    <td colSpan="6">
                      <LoadingRows />
                    </td>
                  </tr>
                ) : !data.workers?.length ? (
                  <tr>
                    <td colSpan="6">
                      <EmptyState
                        title="No active workers"
                        description="Workers appear here when their Redis heartbeat ping is active."
                        icon={Cpu}
                      />
                    </td>
                  </tr>
                ) : (
                  data.workers.map((worker) => (
                    <tr key={worker.workerId}>
                      <td>
                        <div className="worker-name">
                          <span className="worker-icon">
                            <Cpu size={15} />
                          </span>
                          <div>
                            <strong>{worker.workerId}</strong>
                            <small>PID {worker.pid}</small>
                          </div>
                        </div>
                      </td>
                      <td>{worker.status}</td>
                      <td>
                        <Status value={worker.health} />
                      </td>
                      <td>{Math.floor((worker.uptime || 0) / 60)}m</td>
                      <td>
                        {Math.round(
                          (worker.memoryUsage?.rss || 0) / 1024 / 1024
                        )}{" "}
                        MB
                      </td>
                      <td>{worker.secondsSinceLastSeen}s ago</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="footnote">
        <Activity size={13} /> Heartbeats automatically expire after 30 seconds.
        Memory indicates resident set size (RSS).
      </p>
    </>
  );
}

function JobsTable({ jobs, loading, onSelect, empty, emptyDescription, action }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>JOB</th>
            <th>TYPE</th>
            <th>STATUS</th>
            <th>ATTEMPTS</th>
            <th>CREATED</th>
            <th>{action ? "ACTION" : "PRIORITY"}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="6">
                <LoadingRows />
              </td>
            </tr>
          ) : !jobs?.length ? (
            <tr>
              <td colSpan="6">
                <EmptyState
                  title={empty}
                  description={emptyDescription || "No jobs are available yet."}
                  icon={Search}
                />
              </td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr
                key={job.jobId}
                className="clickable-row"
                tabIndex={0}
                aria-label={`Open job ${job.jobId}`}
                onClick={() => onSelect(job.jobId)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(job.jobId);
                  }
                }}
              >
                <td>
                  <div className="job-id">
                    <span className="job-icon">
                      {job.type === "email" ? "@" : "J"}
                    </span>
                    <div>
                      <strong>{shortId(job.jobId)}</strong>
                      <small>{job.jobId}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="type-tag">{job.type}</span>
                </td>
                <td>
                  <Status value={job.status} />
                </td>
                <td>
                  <span className="attempts">
                    {job.attempts || 0}
                    <span> / {job.maxAttempts || 3}</span>
                  </span>
                </td>
                <td>{fmtDate(job.createdAt)}</td>
                <td>
                  {action ? action(job) : <span className="priority">{job.priority ?? 0}</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Status({ value }) {
  const kind = (value || "unknown").toLowerCase();
  return (
    <span className={`status status-${kind}`}>
      <i />
      {value || "UNKNOWN"}
    </span>
  );
}

function LoadingRows() {
  return (
    <div className="loading-state">
      <LoaderCircle size={16} className="spin" /> Loading data…
    </div>
  );
}

function EmptyState({ title, description, icon: Icon }) {
  return (
    <div className="empty-state">
      <div>
        <Icon size={18} />
      </div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function Pagination({ page, pages, total, limit, onChange }) {
  if (!total || total <= limit || pages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <span>
        Showing {total ? (page - 1) * limit + 1 : 0}–
        {Math.min(page * limit, total)} of {total}
      </span>
      <div>
        <button
          className="icon-button bordered"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={14} />
        </button>
        <span>
          Page <b>{page}</b> of {pages}
        </span>
        <button
          className="icon-button bordered"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function JobDetail({ id, onClose, onChanged, notify }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  useEffect(() => {
    api.job(id).then(setJob).catch((e) => setError(errorText(e)));
  }, [id]);

  const copyToClipboard = async (text, type) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(text);
    } catch {
      notify("Could not copy to clipboard. Check browser permissions.", "error");
      return;
    }
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  async function cancel() {
    setBusy(true);
    try {
      await api.cancelJob(id);
      notify("Job cancelled.");
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      await api.retryJob(id);
      notify("Job re-queued for processing.");
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-header">
          <div>
            <div className="eyebrow"><span className="terminal-dot" /> JOB DETAILS</div>
            <h2 id="detail-title">{shortId(id)}</h2>
          </div>
          <div className="drawer-header-actions">
            <kbd className="shortcut-badge">ESC</kbd>
            <button className="icon-button bordered" onClick={onClose} title="Close drawer (Esc)">
              <X size={17} />
            </button>
          </div>
        </div>

        {error ? (
          <ErrorPanel message={error} />
        ) : !job ? (
          <LoadingRows />
        ) : (
          <>
            <div className="drawer-status">
              <Status value={job.status} />
              <button
                className="icon-button"
                title="Copy job ID"
                onClick={() => copyToClipboard(job.jobId, "id")}
              >
                {copiedId ? <Check size={14} /> : <Copy size={15} />}
              </button>
            </div>

            <div className="detail-grid">
              <DetailField label="Job ID" value={job.jobId} mono />
              <DetailField label="Type" value={job.type} />
              <DetailField
                label="Attempts"
                value={`${job.attempts} / ${job.maxAttempts}`}
              />
              <DetailField label="Priority" value={job.priority} />
              <DetailField label="Created" value={fmtDate(job.createdAt)} />
              <DetailField label="Updated" value={fmtDate(job.updatedAt)} />
              <DetailField label="Started" value={fmtDate(job.startedAt)} />
              <DetailField label="Completed" value={fmtDate(job.completedAt)} />
            </div>

            {job.error?.message && (
              <div className="error-block">
                <span>LAST ERROR</span>
                <p>{job.error.message}</p>
                {job.failedAt && <small>{fmtDate(job.failedAt)}</small>}
              </div>
            )}

            <div className="payload-block">
              <div>
                <span>PAYLOAD</span>
                <button
                  className="icon-button"
                  title="Copy payload"
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(job.payload || {}, null, 2),
                      "payload"
                    )
                  }
                >
                  {copiedPayload ? (
                    <Check size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              <pre>{JSON.stringify(job.payload || {}, null, 2)}</pre>
            </div>

            <div className="drawer-footer">
              {job.status === "PENDING" ? (
                <button
                  className="button danger full"
                  disabled={busy}
                  onClick={cancel}
                >
                  {busy ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <X size={14} />
                  )}{" "}
                  Cancel job
                </button>
              ) : ["FAILED", "DEAD"].includes(job.status) ? (
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={retry}
                >
                  {busy ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}{" "}
                  Retry job
                </button>
              ) : (
                <span className="footnote">
                  <Shield size={13} /> This job has no available state actions.
                </span>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value ?? "—"}</strong>
    </div>
  );
}

function CreateJob({ onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [useIdempotency, setUseIdempotency] = useState(true);

  // Form states to support one-click preset templates
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(3);

  const applyTemplate = (type) => {
    if (type === "welcome") {
      setTo("user@example.com");
      setSubject("Welcome to Queue Platform!");
      setBody("Your account has been activated. Welcome to high-throughput background processing!");
      setHtml("<p>Your account has been <strong>activated</strong>.</p>");
      setText("Your account has been activated.");
      setPriority(1);
    } else if (type === "reset") {
      setTo("security@example.com");
      setSubject("Security: Reset your authorization token");
      setBody("Please use token 984-219 to verify your identity.");
      setHtml("<p>Use verification token: <code>984-219</code></p>");
      setText("Use verification token: 984-219");
      setPriority(5);
    } else if (type === "report") {
      setTo("analytics@example.com");
      setSubject("Weekly Job Throughput Digest");
      setBody("99.98% SLA reached. 1,420,000 jobs completed this week.");
      setHtml("<p>Weekly Summary: <strong>1,420,000 jobs completed</strong></p>");
      setText("Weekly Summary: 1,420,000 jobs completed");
      setPriority(2);
    }
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payloadObj = {
        to,
        subject,
        ...(body ? { body } : {}),
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
      };

      const jobData = {
        type: "email",
        payload: payloadObj,
        priority: Number(priority),
        maxAttempts: Number(maxAttempts),
      };

      const result = await api.createJob(
        jobData,
        useIdempotency ? crypto.randomUUID() : ""
      );
      onCreated(result.job);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="overlay modal-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-dialog create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-create-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="eyebrow modal-eyebrow">
              <span className="terminal-dot" /> DISPATCH NEW JOB
            </div>
            <h2 id="modal-create-title">Create Email Job</h2>
          </div>
          <div className="modal-header-actions">
            <kbd className="shortcut-badge">ESC</kbd>
            <button
              className="icon-button bordered"
              onClick={onClose}
              title="Close modal (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="info-callout">
            <span>@</span>
            <div>
              <strong>Email Processor · BullMQ</strong>
              <p>
                Asynchronously processed by distributed Node.js workers with automatic retry backoff.
              </p>
            </div>
          </div>

          <div className="template-pills">
            <span className="template-pills-label">
              <Sparkles size={12} color="var(--primary)" /> Quick templates:
            </span>
            <button
              type="button"
              className="template-pill"
              onClick={() => applyTemplate("welcome")}
            >
              Welcome Email
            </button>
            <button
              type="button"
              className="template-pill"
              onClick={() => applyTemplate("reset")}
            >
              Password Reset
            </button>
            <button
              type="button"
              className="template-pill"
              onClick={() => applyTemplate("report")}
            >
              System Report
            </button>
          </div>

          <form id="create-job-form" onSubmit={submit} className="form-stack modal-form">
            <div className="form-row-2">
              <Field label="Recipient email">
                <input
                  name="to"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label="Subject">
                <input
                  name="subject"
                  required
                  placeholder="Your email subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Body (Plain Text)">
              <textarea
                name="body"
                rows={3}
                placeholder="A plain text message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>

            <div className="form-row-2">
              <Field label="HTML content (optional)">
                <textarea
                  name="html"
                  rows={2}
                  placeholder="<p>Optional HTML content</p>"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                />
              </Field>
              <Field label="Text fallback (optional)">
                <textarea
                  name="text"
                  rows={2}
                  placeholder="Optional plain text version"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
            </div>

            <details className="advanced">
              <summary>
                <Settings2 size={14} /> Advanced execution settings
              </summary>
              <div className="advanced-fields">
                <div className="form-row-2">
                  <Field label="Priority (higher = sooner)">
                    <input
                      name="priority"
                      type="number"
                      min="0"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </Field>
                  <Field label="Max attempts">
                    <input
                      name="maxAttempts"
                      type="number"
                      min="1"
                      step="1"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                    />
                  </Field>
                </div>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={useIdempotency}
                    onChange={(e) => setUseIdempotency(e.target.checked)}
                  />
                  <span>Protect against duplicate submissions (Idempotency Key)</span>
                </label>
              </div>
            </details>

            {error && <InlineError>{error}</InlineError>}
          </form>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-hint">
            <Shield size={13} />
            <span>Redis BullMQ Queue</span>
          </div>
          <div className="modal-footer-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-job-form"
              className="button primary"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Plus size={15} />
              )}{" "}
              Submit job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function InlineError({ children }) {
  return (
    <div className="inline-error">
      <AlertCircle size={15} />
      {children}
    </div>
  );
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="error-panel">
      <AlertCircle size={18} />
      <div>
        <strong>Could not load data</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="button secondary small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
