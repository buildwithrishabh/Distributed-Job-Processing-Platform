import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./styles/index.css";
import { AppRoutes } from "./App.jsx";
import { ErrorBoundary } from "./components/Shell/ErrorBoundary.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ConfigProvider } from "./context/ConfigContext.jsx";
import { LiveProvider } from "./context/LiveContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";

/**
 * Provider order matters:
 *   Config  — resolves the API origin; Auth and Live both need it
 *   Auth    — owns the session
 *   Live    — starts tracking only once Auth says we are signed in
 *   Toast   — mounts last so it can subscribe to transport events emitted by
 *             the others during their initial mount
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ConfigProvider>
          <AuthProvider>
            <LiveProvider>
              <ToastProvider>
                <AppRoutes />
              </ToastProvider>
            </LiveProvider>
          </AuthProvider>
        </ConfigProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
