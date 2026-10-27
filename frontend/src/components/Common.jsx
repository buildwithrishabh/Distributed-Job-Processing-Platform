import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Laptop,
  X,
} from "lucide-react";
import { STATUS_OPTIONS } from "../utils";

export function MobileDesktopOnlyNotice() {
  return (
    <div className="mobile-gate-overlay">
      <div className="mobile-gate-card">
        <div className="mobile-gate-icon-box">
          <Laptop size={32} strokeWidth={1.8} />
        </div>
        <h2 className="mobile-gate-title">Desktop experience required</h2>
        <p className="mobile-gate-subtitle">
          Please open this dashboard on a laptop or desktop screen. The distributed queue
          and worker console is optimized for larger displays.
        </p>
      </div>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PanelTitle({ title, subtitle, action }) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function InlineError({ children }) {
  return (
    <div className="inline-error">
      <AlertCircle size={15} />
      {children}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <div className="error-panel">
      <AlertCircle size={18} />
      <div>
        <strong>Could not load data</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="button secondary small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedConfig =
    STATUS_OPTIONS.find((item) => item.value === value) || STATUS_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!dropdownRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      const activeEl = optionRefs.current[activeIndex];
      if (activeEl) {
        activeEl.focus();
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [open, activeIndex]);

  const openAtSelection = () => {
    const selectedIndex = STATUS_OPTIONS.findIndex((item) => item.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange("");
    dropdownRef.current?.querySelector(".status-select-trigger")?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openAtSelection();
    }
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index + direction + STATUS_OPTIONS.length) % STATUS_OPTIONS.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : STATUS_OPTIONS.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      dropdownRef.current?.querySelector(".status-select-trigger")?.focus();
    }
  };

  return (
    <div className="filter-label status-filter">
      <span>Status</span>
      <div className="status-dropdown" ref={dropdownRef}>
        <button
          type="button"
          className={`status-select-trigger ${value ? "is-active" : ""} ${open ? "is-open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Filter jobs by status. Current selection: ${selectedConfig.label}`}
          onClick={() => (open ? setOpen(false) : openAtSelection())}
          onKeyDown={handleTriggerKeyDown}
        >
          <div className="status-trigger-main">
            <span
              className={`status-indicator-dot dot-${(value || "all").toLowerCase()}`}
              aria-hidden="true"
            />
            <span className="status-trigger-text">{selectedConfig.label}</span>
          </div>

          <div className="status-trigger-right">
            {value && (
              <span
                role="button"
                tabIndex={0}
                className="status-clear-trigger-btn"
                title="Clear status filter"
                aria-label="Clear status filter"
                onClick={clearSelection}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    clearSelection(e);
                  }
                }}
              >
                <X size={12} aria-hidden="true" />
              </span>
            )}
            <ChevronDown size={14} className="status-chevron" aria-hidden="true" />
          </div>
        </button>

        {open && (
          <div className="status-options" role="listbox" aria-label="Job status">
            <div className="status-options-header">
              <span>Filter by status</span>
              {value && (
                <button
                  type="button"
                  className="status-options-reset-link"
                  onClick={() => choose("")}
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="status-options-body">
              {STATUS_OPTIONS.map((item, index) => {
                const isSelected = value === item.value;
                const isAll = item.value === "";
                return (
                  <div key={item.value || "all"}>
                    <button
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`status-option ${isSelected ? "selected" : ""}`}
                      onClick={() => choose(item.value)}
                      onKeyDown={(event) => handleOptionKeyDown(event, index)}
                    >
                      <div className="status-option-left">
                        <span
                          className={`status-indicator-dot dot-${(item.value || "all").toLowerCase()}`}
                          aria-hidden="true"
                        />
                        <div className="status-option-text-group">
                          <span className="status-option-title">{item.label}</span>
                          <span className="status-option-subtitle">{item.desc}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={14} className="status-option-check" aria-hidden="true" />
                      )}
                    </button>
                    {isAll && <div className="status-options-separator" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
