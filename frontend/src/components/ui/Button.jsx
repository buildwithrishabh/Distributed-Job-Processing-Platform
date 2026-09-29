import { forwardRef } from "react";

/**
 * Button.
 *
 * `variant` maps to the `.btn--*` classes in `styles/primitives.css`. When
 * `loading` is set the button stays focusable but inert, so keyboard users do
 * not lose their place while a request is in flight.
 */

export const Button = forwardRef(function Button(
  {
    variant = "secondary",
    size,
    icon,
    iconRight,
    loading = false,
    block = false,
    className = "",
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size ? `btn--${size}` : null,
    block ? "btn--block" : null,
    !children ? "btn--icon" : null,
    loading ? "btn--loading" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export function Spinner({ size = 16, className = "" }) {
  const modifier = size <= 14 ? "spinner--sm" : size <= 22 ? "spinner--md" : "spinner--lg";
  return <span className={`spinner ${modifier} ${className}`} role="status" aria-label="Loading" />;
}

/** Row of mutually exclusive options. */
export function SegmentedControl({ value, onChange, options, className = "", size }) {
  return (
    <div
      className={`segmented ${size === "sm" ? "segmented--sm" : ""} ${className}`}
      role="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className="segmented__item"
            onClick={() => onChange(option.value)}
            title={option.title}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
