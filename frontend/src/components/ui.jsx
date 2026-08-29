import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Inbox,
  Copy,
  Check,
  X,
  CheckCircle2,
  Clock,
  RotateCw,
} from 'lucide-react';

/* ---------------------------------------------------------------------------
   Status badge - maps backend job status to a coloured variant
--------------------------------------------------------------------------- */
export function StatusBadge({ status, dot = true }) {
  if (!status) return <span className="badge badge-cancelled">UNKNOWN</span>;
  const key = String(status).toLowerCase();
  let variant = 'badge-cancelled';
  if (key === 'pending') variant = 'badge-pending';
  else if (key === 'processing') variant = 'badge-processing';
  else if (key === 'retrying') variant = 'badge-retrying';
  else if (key === 'completed') variant = 'badge-completed';
  else if (key === 'failed' || key === 'dead') variant = 'badge-dead';
  return (
    <span className={`badge ${variant}`}>
      {dot && <span className="bdot" />}
      {status}
    </span>
  );
}

export const STATUS_ORDER = [
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'COMPLETED',
  'FAILED',
  'DEAD',
  'CANCELLED',
];

export function statusVariant(status) {
  const k = String(status).toLowerCase();
  if (k === 'pending') return 'warning';
  if (k === 'processing') return 'info';
  if (k === 'retrying') return 'purple';
  if (k === 'completed') return 'success';
  if (k === 'failed' || k === 'dead') return 'danger';
  return 'muted';
}

/* ---------------------------------------------------------------------------
   Copyable text - click to copy job id / tokens etc.
--------------------------------------------------------------------------- */
export function Copyable({ text, display, mono = true, className = '' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <span className={`code-pill ${className}`}>
      <span>{display ?? text}</span>
      <button
        type="button"
        className="copy-btn"
        onClick={copy}
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Formatting helpers
--------------------------------------------------------------------------- */
export function formatRelative(iso) {
  if (!iso) return '-';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* Renders compact locale formatting for large counts (e.g. 12000 -> 12,000). */
export function formatNumber(n) {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '-';
  return Math.round(num).toLocaleString();
}

/* ---------------------------------------------------------------------------
   Animated counter — rolls numeric values up/down smoothly.
--------------------------------------------------------------------------- */
export function useCountUp(target, duration = 650) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(target) || 0;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(from + (to - from) * eased);
      setDisplay(value);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

/* ---------------------------------------------------------------------------
   Skeletons
--------------------------------------------------------------------------- */
export function Skeleton({ style, className = '' }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function StatSkeleton() {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div style={{ flex: 1 }}>
          <Skeleton style={{ width: 60, height: 10 }} />
          <Skeleton style={{ width: 48, height: 28, marginTop: 8 }} />
          <Skeleton style={{ width: 70, height: 9, marginTop: 6 }} />
        </div>
        <Skeleton style={{ width: 42, height: 42, borderRadius: 12 }} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="table-card">
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}>
                  <Skeleton style={{ width: '60%', height: 9 }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="no-hover">
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j}>
                    <Skeleton style={{ width: `${35 + ((i + j) % 4) * 15}%`, height: 11 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   States
--------------------------------------------------------------------------- */
export function EmptyState({ icon: Icon = Inbox, title, subtitle, children, actions }) {
  return (
    <div className="state-box empty-card">
      <Icon size={36} strokeWidth={1.6} />
      <div className="state-title">{title}</div>
      {subtitle && <div className="state-sub">{subtitle}</div>}
      {children}
      {actions}
    </div>
  );
}

export function ErrorState({ message = 'Failed to load data', onRetry }) {
  return (
    <div className="state-box error-card">
      <AlertTriangle size={34} strokeWidth={1.8} color="var(--danger)" />
      <div className="state-title danger">{message}</div>
      <div className="state-sub">The API may be unreachable or the request failed.</div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Toasts
--------------------------------------------------------------------------- */
const TOAST_ICONS = {
  success: <CheckCircle2 size={17} />,
  error: <AlertTriangle size={17} />,
  info: <Clock size={17} />,
  warning: <RotateCw size={17} />,
};

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'success'}`}>
          <span className="toast-ico">{TOAST_ICONS[t.type || 'success']}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Small presentational bits
--------------------------------------------------------------------------- */
export function PriorityDots({ value = 0 }) {
  const total = 5;
  const levels = [value > 8, value > 5, value > 3, value > 1, value >= 1];
  return (
    <span className="priority-dots" title={`Priority ${value}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`pdot ${levels[i] ? 'fill' : ''}`} />
      ))}
    </span>
  );
}

export function AttemptCount({ attempts = 0, maxAttempts = 3, danger = 'dead' }) {
  const ratio = maxAttempts > 0 ? Math.min(1, attempts / maxAttempts) : 0;
  const color = ratio >= 1 ? 'var(--danger)' : ratio >= 0.6 ? 'var(--warning)' : 'var(--success)';
  return (
    <span className="attempts-track">
      <span className="track">
        <span className="track-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      </span>
      <span className="cell-muted">{attempts}/{maxAttempts}</span>
    </span>
  );
}
