import { Icons } from "./Icons.jsx";

const ICONS = {
  success: Icons.check,
  error: Icons.alert,
  warning: Icons.alert,
  info: Icons.info,
  neutral: Icons.info,
};

const TONE_CLASS = {
  success: "toast--success",
  error: "toast--error",
  danger: "toast--error",
  warning: "toast--warning",
  warn: "toast--warning",
  info: "toast--info",
  neutral: "toast--info",
};

/**
 * A single toast. Presentational on purpose — it takes a `toast` object and an
 * `onDismiss` callback so the provider owns all lifetime logic.
 */
export function Toast({ toast, onDismiss }) {
  const Glyph = ICONS[toast.tone] ?? Icons.info;
  const toneClass = TONE_CLASS[toast.tone] ?? "toast--info";

  return (
    <div className={`toast ${toneClass}`} role="status">
      <span className="toast__icon">
        <Glyph size={16} />
      </span>
      <div className="toast__content">
        <div className="toast__title">{toast.title}</div>
        {toast.description ? <div className="toast__message">{toast.description}</div> : null}
      </div>
      <button
        type="button"
        className="toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <Icons.close size={14} />
      </button>
    </div>
  );
}
