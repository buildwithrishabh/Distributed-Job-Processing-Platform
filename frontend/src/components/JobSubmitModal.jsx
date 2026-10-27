import { useState } from "react";
import {
  LoaderCircle,
  Plus,
  Settings2,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { Field, InlineError } from "./Common";

export function JobSubmitModal({ onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [useIdempotency, setUseIdempotency] = useState(true);

  // Form states to support one-click preset templates
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(3);

  const applyTemplate = (type) => {
    if (type === "welcome") {
      setTo("user@example.com");
      setSubject("Welcome to Queue Platform!");
      setBody("Your account has been activated. Welcome to high-throughput background processing!");
      setHtml("<p>Your account has been <strong>activated</strong>.</p>");
      setText("Your account has been activated.");
      setPriority(1);
    } else if (type === "reset") {
      setTo("security@example.com");
      setSubject("Security: Reset your authorization token");
      setBody("Please use token 984-219 to verify your identity.");
      setHtml("<p>Use verification token: <code>984-219</code></p>");
      setText("Use verification token: 984-219");
      setPriority(5);
    } else if (type === "report") {
      setTo("analytics@example.com");
      setSubject("Weekly Job Throughput Digest");
      setBody("99.98% SLA reached. 1,420,000 jobs completed this week.");
      setHtml("<p>Weekly Summary: <strong>1,420,000 jobs completed</strong></p>");
      setText("Weekly Summary: 1,420,000 jobs completed");
      setPriority(2);
    }
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payloadObj = {
        to,
        subject,
        ...(body ? { body } : {}),
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
      };

      const jobData = {
        type: "email",
        payload: payloadObj,
        priority: Number(priority),
        maxAttempts: Number(maxAttempts),
      };

      const result = await api.createJob(
        jobData,
        useIdempotency ? crypto.randomUUID() : ""
      );
      onCreated(result.job);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="overlay modal-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-dialog create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-create-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="eyebrow modal-eyebrow">
              <span className="terminal-dot" /> DISPATCH NEW JOB
            </div>
            <h2 id="modal-create-title">Create Email Job</h2>
          </div>
          <div className="modal-header-actions">
            <kbd className="shortcut-badge">ESC</kbd>
            <button
              className="icon-button bordered"
              onClick={onClose}
              title="Close modal (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="info-callout">
            <span>@</span>
            <div>
              <strong>Email Processor · BullMQ</strong>
              <p>
                Asynchronously processed by distributed Node.js workers with automatic retry backoff.
              </p>
            </div>
          </div>

          <div className="template-pills">
            <span className="template-pills-label">
              <Sparkles size={12} color="var(--primary)" /> Quick templates:
            </span>
            <button
              type="button"
              className="template-pill"
              onClick={() => applyTemplate("welcome")}
            >
              Welcome Email
            </button>
            <button
              type="button"
              className="template-pill"
              onClick={() => applyTemplate("reset")}
            >
              Password Reset
            </button>
            <button
              type="button"
              className="template-pill"
              onClick={() => applyTemplate("report")}
            >
              System Report
            </button>
          </div>

          <form id="create-job-form" onSubmit={submit} className="form-stack modal-form">
            <div className="form-row-2">
              <Field label="Recipient email">
                <input
                  name="to"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label="Subject">
                <input
                  name="subject"
                  required
                  placeholder="Your email subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Body (Plain Text)">
              <textarea
                name="body"
                rows={3}
                placeholder="A plain text message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>

            <div className="form-row-2">
              <Field label="HTML content (optional)">
                <textarea
                  name="html"
                  rows={2}
                  placeholder="<p>Optional HTML content</p>"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                />
              </Field>
              <Field label="Text fallback (optional)">
                <textarea
                  name="text"
                  rows={2}
                  placeholder="Optional plain text version"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
            </div>

            <details className="advanced">
              <summary>
                <Settings2 size={14} /> Advanced execution settings
              </summary>
              <div className="advanced-fields">
                <div className="form-row-2">
                  <Field label="Priority (higher = sooner)">
                    <input
                      name="priority"
                      type="number"
                      min="0"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </Field>
                  <Field label="Max attempts">
                    <input
                      name="maxAttempts"
                      type="number"
                      min="1"
                      step="1"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                    />
                  </Field>
                </div>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={useIdempotency}
                    onChange={(e) => setUseIdempotency(e.target.checked)}
                  />
                  <span>Protect against duplicate submissions (Idempotency Key)</span>
                </label>
              </div>
            </details>

            {error && <InlineError>{error}</InlineError>}
          </form>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-hint">
            <Shield size={13} />
            <span>Redis BullMQ Queue</span>
          </div>
          <div className="modal-footer-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-job-form"
              className="button primary"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Plus size={15} />
              )}{" "}
              Submit job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobSubmitModal;
