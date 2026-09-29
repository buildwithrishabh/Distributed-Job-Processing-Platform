import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icons } from "./Icons.jsx";
import { useFocusTrap } from "../../lib/hooks/index.js";

/**
 * Modal + Drawer.
 *
 * Implemented with a portal, a scrim that closes on click, Escape-to-close, a
 * focus trap, scroll lock, and focus restoration to the trigger. Rendered
 * conditionally by the caller, so no `isOpen` prop is needed here.
 */

const SIZES = { sm: "modal--sm", md: "modal--md", lg: "modal--lg", xl: "modal--xl" };

export function Modal({ title, subtitle, size = "md", onClose, children, footer, bodyFlush = false }) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => closeRef.current?.(), []);
  // `useFocusTrap` already owns the scroll lock; a second save/restore here
  // would fight it on unmount and could unlock while the modal is still open.
  const containerRef = useFocusTrap(true, { onEscape: handleEscape });

  return createPortal(
    <div className="overlay overlay--center" role="presentation">
      <button
        type="button"
        className="overlay__scrim"
        aria-label="Close dialog"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={containerRef}
        className={`modal ${SIZES[size] ?? SIZES.md}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        {title ? (
          <div className="overlay__header">
            <div>
              <h2 className="overlay__title">{title}</h2>
              {subtitle ? <p className="overlay__subtitle">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--icon"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <Icons.close size={16} />
            </button>
          </div>
        ) : null}
        <div className={["overlay__body", bodyFlush ? "overlay__body--flush" : null].filter(Boolean).join(" ")}>
          {children}
        </div>
        {footer ? <div className="overlay__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ title, subtitle, onClose, children, footer, bodyFlush = false }) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => closeRef.current?.(), []);
  const containerRef = useFocusTrap(true, { onEscape: handleEscape });

  return createPortal(
    <div className="overlay overlay--right" role="presentation">
      <button
        type="button"
        className="overlay__scrim"
        aria-label="Close panel"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={containerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        {title ? (
          <div className="overlay__header">
            <div>
              <h2 className="overlay__title">{title}</h2>
              {subtitle ? <p className="overlay__subtitle">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--icon"
              onClick={onClose}
              aria-label="Close panel"
            >
              <Icons.close size={16} />
            </button>
          </div>
        ) : null}
        <div className={["overlay__body", bodyFlush ? "overlay__body--flush" : null].filter(Boolean).join(" ")}>
          {children}
        </div>
        {footer ? <div className="overlay__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Lightweight anchored popover. Positions itself with fixed coordinates derived
 * from the trigger's bounding rect, flipping vertically when there is not
 * enough room below.
 */
export function Popover({ trigger, children, align = "end", open, onClose, className = "" }) {
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelHeight = panelRef.current?.offsetHeight ?? 200;
      const flip = rect.bottom + panelHeight + 12 > window.innerHeight;
      setCoords({
        top: flip ? Math.max(8, rect.top - panelHeight - 6) : rect.bottom + 6,
        left: align === "end" ? Math.max(8, rect.right - 200) : rect.left,
      });
    };
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      const target = event.target;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onClose?.();
    };
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="popover-root" data-popover-root>
      <span ref={triggerRef} className="popover-anchor">
        {trigger}
      </span>
      {open && coords ? (
        <div
          ref={panelRef}
          className={`popover ${className}`}
          style={{ top: coords.top, left: coords.left }}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      className={["popover__item", danger ? "popover__item--danger" : null].filter(Boolean).join(" ")}
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div className="popover__sep" role="separator" />;
}

export function MenuLabel({ children }) {
  return <div className="popover__label">{children}</div>;
}
