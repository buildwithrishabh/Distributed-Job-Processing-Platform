import { forwardRef, useId, useState } from "react";

import { Icons } from "./Icons.jsx";

/**
 * Form primitives.
 *
 * Every field wires up its own label, hint and error with generated ids, so a
 * screen reader announces the constraint and the error together. Callers pass
 * `error` (a string) and it lands in `aria-describedby` automatically.
 */

function FieldShell({ id, label, hint, error, required, children, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label ? (
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">
          <Icons.alert size={12} />
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(id, hint, error) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, mono, icon, affix, className = "", id: providedId, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  const input = (
    <input
      ref={ref}
      id={id}
      className={[
        "input",
        mono ? "input--mono" : null,
        error ? "input--invalid" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={describedBy(id, hint, error)}
      required={required}
      {...rest}
    />
  );

  const wrapped = icon || affix ? (
    <div className="input-wrap">
      {icon ? <span className="input-wrap__icon">{icon}</span> : null}
      {input}
      {affix ? <span className="input-wrap__affix">{affix}</span> : null}
    </div>
  ) : (
    input
  );

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      {wrapped}
    </FieldShell>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, className = "", id: providedId, rows = 4, mono = false, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={[
          "textarea",
          mono ? "textarea--mono" : null,
          error ? "textarea--invalid" : null,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, options = [], className = "", id: providedId, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={id}
        className={["select", className].filter(Boolean).join(" ")}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? "true" : undefined}
        required={required}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

/** Password field with a reveal toggle. */
export const PasswordInput = forwardRef(function PasswordInput(
  { label, hint, error, required, className = "", id: providedId, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <div className="input-wrap">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          className={["input", "input--mono", error ? "input--invalid" : null, className]
            .filter(Boolean)
            .join(" ")}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy(id, hint, error)}
          required={required}
          {...rest}
        />
        <span className="input-wrap__affix">
          <button
            type="button"
            className="btn btn--ghost btn--xs btn--icon"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {visible ? <Icons.eyeOff size={15} /> : <Icons.eye size={15} />}
          </button>
        </span>
      </div>
    </FieldShell>
  );
});

export function Checkbox({ label, className = "", disabled, ...rest }) {
  return (
    <label className={["checkbox", disabled ? "checkbox--disabled" : null, className].filter(Boolean).join(" ")}>
      <input type="checkbox" disabled={disabled} {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled, id: providedId }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="switch-row">
      <button
        id={id}
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
      {label ? (
        <label className="switch-row__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
    </div>
  );
}
