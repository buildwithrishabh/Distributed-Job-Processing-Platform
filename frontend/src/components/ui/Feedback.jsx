import { Icons } from "./Icons.jsx";

export function Skeleton({ width, height = 14, radius, className = "", style, ...rest }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ display: "block", width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`skeleton-stack ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height={12}
          style={{ width: index === lines - 1 ? "62%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="skeleton-table__row" key={rowIndex}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              height={12}
              style={{ width: colIndex === 0 ? "55%" : `${80 - colIndex * 9}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <div className={["empty", compact ? "empty--compact" : null].filter(Boolean).join(" ")}>
      {icon ? <div className="empty__icon">{icon}</div> : null}
      <div className="empty__title">{title}</div>
      {description ? <p className="empty__desc">{description}</p> : null}
      {action}
    </div>
  );
}

/** @param {number} value 0..1 @param {'success'|'warning'|'danger'} [tone] */
export function Progress({ value, tone, indeterminate = false, className = "" }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
  const fillClass = tone ? `progress__fill--${tone}` : null;
  return (
    <div
      className={["progress", indeterminate ? "progress--indeterminate" : null, className]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={["progress__fill", fillClass].filter(Boolean).join(" ")}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

const ALERT_TONE = {
  success: "alert--success",
  warning: "alert--warning",
  danger: "alert--danger",
  brand: "alert--brand",
  info: "alert--info",
};

const ALERT_ICON = {
  success: Icons.check,
  warning: Icons.alert,
  danger: Icons.alert,
  brand: Icons.info,
  info: Icons.info,
};

export function Alert({ tone = "info", title, children, actions, icon, className = "" }) {
  const Glyph = ALERT_ICON[tone] ?? Icons.info;
  return (
    <div
      className={["alert", ALERT_TONE[tone] ?? ALERT_TONE.info, className].filter(Boolean).join(" ")}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span className="alert__icon">{icon ?? <Glyph size={16} />}</span>
      <div className="alert__body">
        {title ? <div className="alert__title">{title}</div> : null}
        {children}
        {actions ? <div className="alert__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Label/value pair used across the detail views. */
export function KeyValue({ items, stacked = false, className = "" }) {
  return (
    <div className={["kv", stacked ? "kv--stacked" : null, className].filter(Boolean).join(" ")}>
      {items.map((item, index) => (
        <div key={item.key ?? index} style={{ display: "contents" }}>
          <div className="kv__key">{item.key}</div>
          <div className="kv__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
