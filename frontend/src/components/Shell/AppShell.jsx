import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";
import { ThrottleBanner } from "./ThrottleBanner.jsx";
import { Icons } from "../ui/Icons.jsx";
import { Button } from "../ui/Button.jsx";
import { useLocalStorage } from "../../lib/hooks/index.js";
import { CreateJobDialog } from "../../views/CreateJobDialog.jsx";

const COLLAPSE_KEY = "njq.sidebarCollapsed";

/** Per-route header copy, matched most-specific first. */
const ROUTE_META = [
  { pattern: /^\/jobs\/[^/]+$/, title: "Job detail", subtitle: "Payload, attempts and result" },
  { pattern: /^\/jobs$/, title: "Jobs", subtitle: "Every job this account has submitted" },
  { pattern: /^\/dead-letter$/, title: "Dead letter queue", subtitle: "Exhausted jobs, ready to retry" },
  { pattern: /^\/workers$/, title: "Workers", subtitle: "Registered consumers and their health" },
  { pattern: /^\/settings$/, title: "Settings", subtitle: "Endpoint, runtime values and appearance" },
  { pattern: /^\/$/, title: "Overview", subtitle: "Queue health at a glance" },
];

function routeMetaFor(pathname) {
  return ROUTE_META.find((entry) => entry.pattern.test(pathname)) ?? { title: "Console", subtitle: null };
}

/**
 * Authenticated application shell.
 *
 * Provides the persistent chrome (sidebar, topbar, throttle banner) and the
 * routed page content. Owns sidebar collapse state, the mobile drawer, and the
 * create-job dialog so the "New job" action is reachable from anywhere.
 */
export function AppShell() {
  const location = useLocation();
  const mainRef = useRef(null);
  const [collapsed, setCollapsed] = useLocalStorage(COLLAPSE_KEY, false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  // `.main` is the scroll container, so the browser's own "reset on navigate"
  // behaviour no longer applies — do it explicitly or the next page opens
  // halfway down.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const { title, subtitle } = routeMetaFor(location.pathname);

  // "n" opens the create dialog, "/" focuses search, "g then <key>" jumps.
  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "n") {
        event.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="main" ref={mainRef}>
        <Topbar
          title={title}
          subtitle={subtitle}
          onOpenMobileNav={() => setMobileOpen(true)}
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={<Icons.plus size={15} />}
              onClick={() => setCreateOpen(true)}
              title="New job (n)"
            >
              New job
            </Button>
          }
        />

        <ThrottleBanner />

        <main className="page" id="main">
          <Outlet context={{ openCreateJob: () => setCreateOpen(true) }} />
        </main>
      </div>

      {createOpen ? <CreateJobDialog onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}
