import { useState } from "react";
import { CalendarClock, LoaderCircle, Plus, Settings2, Shield, Sparkles, X } from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { Field, InlineError } from "./Common";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo",
];

const CRON_PRESETS = [
  { label: "Every 1 min", expr: "* * * * *" },
  { label: "Every 5 mins", expr: "*/5 * * * *" },
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily 9 AM", expr: "0 9 * * *" },
];

export function ScheduleCreateModal({ onClose, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState("RECURRING");
  const [runAtLocal, setRunAtLocal] = useState("");
  const [cronExpression, setCronExpression] = useState("*/5 * * * *");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [misfirePolicy, setMisfirePolicy] = useState("SKIP");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(3);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = {
        to,
        subject,
        ...(body ? { body } : {}),
      };

      const bodyData = {
        name,
        jobType: "email",
        payload,
        scheduleType,
        timezone,
        misfirePolicy,
        priority: Number(priority),
        maxAttempts: Number(maxAttempts),
        ...(scheduleType === "ONCE"
          ? { runAt: new Date(runAtLocal).toISOString() }
          : { cronExpression }),
      };

      const res = await api.createSchedule(bodyData);
      onCreated(res.schedule);
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
        aria-labelledby="modal-schedule-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="eyebrow modal-eyebrow">
              <span className="terminal-dot" /> NEW JOB SCHEDULE
            </div>
            <h2 id="modal-schedule-title">Create Schedule</h2>
          </div>
          <div className="modal-header-actions">
            <kbd className="shortcut-badge">ESC</kbd>
            <button className="icon-button bordered" onClick={onClose} title="Close modal (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <form id="create-schedule-form" onSubmit={submit} className="form-stack modal-form">
            <div className="form-row-2">
              <Field label="Schedule name">
                <input
                  required
                  placeholder="e.g., Daily Digest"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Schedule type">
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                >
                  <option value="RECURRING">RECURRING (Cron)</option>
                  <option value="ONCE">ONCE (One-time)</option>
                </select>
              </Field>
            </div>

            {scheduleType === "ONCE" ? (
              <Field label="Run at (local time)">
                <input
                  type="datetime-local"
                  required
                  value={runAtLocal}
                  onChange={(e) => setRunAtLocal(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <div className="template-pills">
                  <span className="template-pills-label">
                    <Sparkles size={12} color="var(--primary)" /> Cron presets:
                  </span>
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.expr}
                      type="button"
                      className="template-pill"
                      onClick={() => setCronExpression(p.expr)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="form-row-2">
                  <Field label="Cron expression">
                    <input
                      required
                      placeholder="*/5 * * * *"
                      value={cronExpression}
                      onChange={(e) => setCronExpression(e.target.value)}
                    />
                  </Field>
                  <Field label="Timezone">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}

            <div className="form-row-2">
              <Field label="Recipient email">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
              <Field label="Email subject">
                <input
                  required
                  placeholder="Scheduled report"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Email body (optional)">
              <textarea
                rows={2}
                placeholder="Plain text message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>

            <details className="advanced">
              <summary>
                <Settings2 size={14} /> Advanced scheduler settings
              </summary>
              <div className="advanced-fields">
                <div className="form-row-2">
                  <Field label="Misfire policy">
                    <select
                      value={misfirePolicy}
                      onChange={(e) => setMisfirePolicy(e.target.value)}
                    >
                      <option value="SKIP">SKIP (Ignore missed)</option>
                      <option value="RUN_ONCE">RUN_ONCE (Catch up once)</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <input
                      type="number"
                      min="0"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Max attempts">
                  <input
                    type="number"
                    min="1"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                  />
                </Field>
              </div>
            </details>

            {error && <InlineError>{error}</InlineError>}
          </form>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-hint">
            <CalendarClock size={13} />
            <span>Dispatches into BullMQ job-queue</span>
          </div>
          <div className="modal-footer-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="create-schedule-form"
              className="button primary"
              disabled={busy}
            >
              {busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}{" "}
              Create schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleCreateModal;
