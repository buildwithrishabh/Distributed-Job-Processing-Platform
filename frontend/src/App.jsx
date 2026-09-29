import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "./components/Shell/AppShell.jsx";
import { Spinner } from "./components/ui/Button.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { LoginView } from "./views/LoginView.jsx";

// Route-split: the console shell is the only thing needed for first paint.
const OverviewView = lazy(() => import("./views/OverviewView.jsx").then((m) => ({ default: m.OverviewView })));
const JobsView = lazy(() => import("./views/JobsView.jsx").then((m) => ({ default: m.JobsView })));
const JobDetailView = lazy(() => import("./views/JobDetailView.jsx").then((m) => ({ default: m.JobDetailView })));
const WorkersView = lazy(() => import("./views/WorkersView.jsx").then((m) => ({ default: m.WorkersView })));
const SettingsView = lazy(() => import("./views/SettingsView.jsx").then((m) => ({ default: m.SettingsView })));

function RouteFallback() {
  return (
    <div className="boot" style={{ minHeight: "50vh" }}>
      <Spinner size={26} />
    </div>
  );
}

/**
 * Blocks a route until the session is known.
 *
 * The wait matters: without it, a reload on a protected route briefly renders
 * the login screen for an already-authenticated user, and then swaps it for the
 * dashboard. A network failure is *not* treated as signed out — that would
 * eject a logged-in user every time the API hiccups.
 */
function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="boot">
        <div className="boot__inner">
          <Spinner size={30} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return children;
}

/** Signed-in users should not be able to reach the sign-in screen. */
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="boot">
        <div className="boot__inner">
          <Spinner size={30} />
        </div>
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

/**
 * The shell is the layout route for every authenticated page; `AppShell` reads
 * the location to derive the header copy, so routes here only declare paths.
 */
function ShellFrame() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/signin"
        element={
          <RedirectIfAuthed>
            <LoginView />
          </RedirectIfAuthed>
        }
      />

      {/* The shell is the layout route; children render into its <Outlet />. */}
      <Route element={<ShellFrame />}>
        <Route
          index
          element={
            <Suspense fallback={<RouteFallback />}>
              <OverviewView />
            </Suspense>
          }
        />
        <Route
          path="jobs"
          element={
            <Suspense fallback={<RouteFallback />}>
              <JobsView />
            </Suspense>
          }
        />
        <Route
          path="jobs/:jobId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <JobDetailView />
            </Suspense>
          }
        />
        <Route
          path="dead-letter"
          element={
            <Suspense fallback={<RouteFallback />}>
              <JobsView deadOnly />
            </Suspense>
          }
        />
        <Route
          path="workers"
          element={
            <Suspense fallback={<RouteFallback />}>
              <WorkersView />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<RouteFallback />}>
              <SettingsView />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
