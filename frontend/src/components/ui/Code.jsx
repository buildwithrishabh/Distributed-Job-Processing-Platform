import { useState } from "react";

import { Icons } from "./Icons.jsx";
import { Button } from "./Button.jsx";

/**
 * JSON viewer.
 *
 * Tints tokens by walking the string with a regex and emitting spans — no
 * `dangerouslySetInnerHTML`, so a hostile payload in a job's `error` field
 * cannot inject markup.
 */

const TOKEN_RE =
  /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?|[{}[\],:])/g;

function tokenClass(token) {
  if (/^[{}[\],:]/.test(token)) return "tok-punct";
  if (token.startsWith('"')) return token.endsWith(":") ? "tok-key" : "tok-string";
  if (/^(true|false)$/.test(token)) return "tok-boolean";
  if (token === "null") return "tok-null";
  if (/^-?\d/.test(token)) return "tok-number";
  return null;
}

function highlight(text) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const cls = tokenClass(raw);
    nodes.push(
      cls ? (
        <span key={`${match.index}-${raw}`} className={cls}>
          {raw}
        </span>
      ) : (
        raw
      ),
    );
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function JsonView({ data, scroll = true, className = "" }) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2) ?? "null";
  return (
    <pre
      className={[scroll ? "json-view" : "json-view json-view--static", className]
        .filter(Boolean)
        .join(" ")}
    >
      <code>{highlight(text)}</code>
    </pre>
  );
}

export function CopyButton({ value, label = "Copy", size = "xs" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      } catch {
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1_600);
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={copy}
      icon={copied ? <Icons.check size={13} /> : <Icons.copy size={13} />}
      data-copied={copied ? "true" : undefined}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

export function CodeBlock({ value, language = "json", scroll = true, copyable = true, danger = false, className = "" }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div
      className={[
        "code",
        scroll ? "code--scroll" : null,
        danger ? "code--danger" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="code__bar">
        <span>{language}</span>
        {copyable ? <CopyButton value={text} /> : null}
      </div>
      <pre>
        <code>{language === "json" ? highlight(text) : text}</code>
      </pre>
    </div>
  );
}

export function CopyableValue({ value, display, mono = true }) {
  const [copied, setCopied] = useState(false);
  const text = String(value ?? "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1_600);
  };

  return (
    <span className="copyable">
      <span className={mono ? "copyable__text" : "copyable__text copyable__text--sans"} title={text}>
        {display ?? text}
      </span>
      <button
        type="button"
        className="copyable__btn"
        onClick={copy}
        data-copied={copied ? "true" : undefined}
        aria-label={copied ? "Copied" : "Copy value"}
      >
        {copied ? <Icons.check size={13} /> : <Icons.copy size={13} />}
      </button>
    </span>
  );
}
