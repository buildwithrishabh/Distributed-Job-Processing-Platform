export function Card({
  children,
  className = "",
  interactive = false,
  flush = false,
  glass = false,
  accent = false,
  as: Element = "div",
  ...rest
}) {
  const classes = [
    "card",
    interactive ? "card--interactive" : null,
    flush ? "card--flush" : null,
    glass ? "card--glass" : null,
    accent ? "card--accent" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Element className={classes} {...rest}>
      {children}
    </Element>
  );
}

export function CardHeader({ title, subtitle, actions, icon, children }) {
  return (
    <div className="card__header">
      <div className="card__titles">
        <div className="card__title">
          {icon}
          {title}
        </div>
        {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
        {children}
      </div>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ children, tight = false, flush = false, className = "" }) {
  return (
    <div
      className={[
        "card__body",
        tight ? "card__body--tight" : null,
        flush ? "card__body--flush" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children }) {
  return <div className="card__footer">{children}</div>;
}

const BADGE_TONE = {
  neutral: "badge--neutral",
  brand: "badge--brand",
  primary: "badge--brand",
  success: "badge--success",
  warning: "badge--warning",
  danger: "badge--danger",
  error: "badge--danger",
  info: "badge--info",
  accent: "badge--accent",
};

export function Badge({ tone = "neutral", dot = false, solid = false, size, className = "", children, ...rest }) {
  return (
    <span
      className={[
        "badge",
        BADGE_TONE[tone] ?? BADGE_TONE.neutral,
        dot ? "badge--dot" : null,
        solid ? "badge--solid" : null,
        size === "lg" ? "badge--lg" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * Job status pill. Colour is driven by `data-status` in CSS so a new backend
 * status automatically picks up the neutral fallback rather than breaking.
 */
export function StatusPill({ status, live = false, className = "" }) {
  const value = String(status ?? "PENDING").toUpperCase();
  return (
    <span
      className={[
        "badge",
        "status-pill",
        live ? "status-pill--live" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={value}
    >
      {value}
    </span>
  );
}
