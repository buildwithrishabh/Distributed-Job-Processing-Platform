import { useState } from "react";

import { Icons } from "../ui/Icons.jsx";
import { MenuItem, MenuSeparator, Popover } from "../ui/Overlay.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useConfig } from "../../context/ConfigContext.jsx";
import { useLiveState, useLive, useOnlineStatus } from "../../context/LiveContext.jsx";
import { useTicker } from "../../lib/hooks/index.js";
import { secondsSinceUpdate } from "../../lib/live/metricsStore.js";

/**
 * Connection indicator.
 *
 * Distinguishes four states, because they mean different things operationally:
 *   live     — SSE stream is open, data is push-delivered
 *   polling  — no stream available, falling back to periodic fetches
 *   offline  — browser reports no connectivity
 *   degraded — requests are failing
 */
function ConnectionPill() {
  const live = useLiveState();
  const online = useOnlineStatus();
  const { refresh } = useLive();

  // The ticker has to live *here*, not in a provider: this is the component
  // that renders the "Xs ago" label, and a provider re-render does not
  // re-render its children subtree.
  useTicker(1_000);

  let state = "idle";
  let label = "Connecting";
  let title = "Establishing a connection to the API.";

  if (!online) {
    state = "offline";
    label = "Offline";
    title = "Your browser is offline. Reconnecting when connectivity returns.";
  } else if (live.error && live.consecutiveErrors > 0) {
    state = "degraded";
    label = "Degraded";
    title = live.error.displayMessage ?? "The API is not responding normally.";
  } else if (live.transport === "sse") {
    state = "live";
    label = "Live";
    title = "Connected to the event stream. Updates arrive in real time.";
  } else if (live.transport === "poll") {
    state = "polling";
    label = "Polling";
    title = "Live events are not available on this server, so data refreshes periodically.";
  } else if (live.status === "loading") {
    state = "idle";
    label = "Connecting";
  }

  const ago = secondsSinceUpdate();

  return (
    <button
      type="button"
      className="conn"
      onClick={refresh}
      title={`${title}\nClick to refresh now.`}
    >
      <span className="conn__dot" data-state={state} />
      {label}
      {ago != null ? <span className="conn__meta">· {ago}s ago</span> : null}
    </button>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useConfig();
  const [open, setOpen] = useState(false);

  const initials = (user?.name ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button type="button" className="user-trigger" aria-haspopup="menu" aria-expanded={open}>
          <span className="avatar">{initials || "?"}</span>
          <span className="user-trigger__name">{user?.name ?? user?.email ?? "Account"}</span>
          <Icons.chevronDown size={14} className="chev" {...{ "data-open": open ? "true" : "false" }} />
        </button>
      }
    >
      <div className="popover__label">Signed in as</div>
      <div style={{ padding: "4px 12px 8px", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
        {user?.email}
      </div>
      <MenuSeparator />
      <MenuItem
        icon={theme === "dark" ? <Icons.sun size={15} /> : <Icons.moon size={15} />}
        onClick={() => {
          toggleTheme();
          setOpen(false);
        }}
      >
        {theme === "dark" ? "Light theme" : "Dark theme"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<Icons.logout size={15} />}
        danger
        onClick={() => {
          setOpen(false);
          signOut();
        }}
      >
        Sign out
      </MenuItem>
    </Popover>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 */
export function Topbar({ title, subtitle, onOpenMobileNav, actions }) {
  return (
    <header className="topbar">
      <div className="topbar__lead">
        <button
          type="button"
          className="btn btn--ghost btn--sm btn--icon topbar__menu"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Icons.menu size={18} />
        </button>
        <div className="topbar__titles">
          <h1 className="topbar__title">{title}</h1>
          {subtitle ? <span className="topbar__subtitle">{subtitle}</span> : null}
        </div>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        {actions}
        <ConnectionPill />
        <span className="topbar__divider" />
        <UserMenu />
      </div>
    </header>
  );
}
