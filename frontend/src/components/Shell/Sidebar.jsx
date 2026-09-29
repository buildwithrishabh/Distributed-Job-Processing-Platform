import { NavLink } from "react-router-dom";

import { Icons } from "../ui/Icons.jsx";
import { useConfig } from "../../context/ConfigContext.jsx";
import { useLiveState } from "../../context/LiveContext.jsx";

/**
 * Primary navigation.
 *
 * The job-status counts in the sidebar come from the live store, so they update
 * on the same cadence as the dashboard without a second set of requests.
 */

function NavItem({ to, icon, label, count, danger, end = false }) {
  return (
    // Active styling is driven by `aria-current="page"`, which NavLink sets
    // itself — do not add a class for it.
    <NavLink
      to={to}
      end={end}
      className={["nav-item", danger ? "nav-item--danger" : null].filter(Boolean).join(" ")}
    >
      {icon}
      <span className="nav-item__label">{label}</span>
      {count != null && count > 0 ? <span className="nav-item__count">{count}</span> : null}
    </NavLink>
  );
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { originLabel } = useConfig();
  const live = useLiveState();
  const dead = Number(live.overview?.jobs?.DEAD ?? 0);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className="sidebar"
        data-collapsed={collapsed ? "true" : "false"}
        data-mobile-open={mobileOpen ? "true" : undefined}
        onClick={(event) => {
          // Tapping a link on mobile should dismiss the drawer.
          if (mobileOpen && event.target.closest("a")) onCloseMobile?.();
        }}
      >
        <div className="sidebar__brand">
          <span className="brand-mark" aria-hidden="true">
            <Icons.layers size={17} />
          </span>
          <span className="brand-text">
            <span className="brand-text__name">
              Queue<em>Forge</em>
            </span>
            <span className="brand-text__tag">Job Control</span>
          </span>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          <NavItem to="/" end icon={<Icons.dashboard size={17} />} label="Overview" />

          <div className="nav-section__label">Queue</div>

          {/*
            Only one entry for jobs. Per-status links used to live here, but
            every one of them shares the pathname `/jobs` — NavLink matches on
            pathname only, so they all highlighted together. Status filtering is
            a view concern and lives in the Jobs toolbar.
          */}
          <NavItem
            to="/jobs"
            icon={<Icons.jobs size={17} />}
            label="All jobs"
            count={live.overview?.jobs?.total ?? 0}
          />
          <NavItem to="/dead-letter" icon={<Icons.dead size={17} />} label="Dead letter" count={dead} danger />

          <div className="nav-section__label">Cluster</div>

          <NavItem
            to="/workers"
            icon={<Icons.workers size={17} />}
            label="Workers"
            count={live.overview?.workers?.activeWorkerCount ?? 0}
          />
          <NavItem to="/settings" icon={<Icons.settings size={17} />} label="Settings" />
        </nav>

        <div className="sidebar__footer">
          <span className="conn__meta" title={`Connected to ${originLabel}`} style={{ paddingInline: 12 }}>
            {originLabel}
          </span>
          <button
            type="button"
            className="sidebar__collapse"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Icons.chevronRight size={16} /> : <Icons.chevronLeft size={16} />}
            <span>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}
