import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../api";
import { errorText, fmtDate, shortId } from "../utils";
import { ErrorPanel, Field, InlineError } from "./Common";
import { DetailField } from "./JobDetailModal";
import { LoadingRows } from "./JobsTable";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo",
];

const scheduleStatusKind = (status) => {
  if (status === "ACTIVE" || status === "COMPLETED") return "completed";
  if (status === "PAUSED") return "retrying";
  if (status === "CANCELLED") return "cancelled";
  return "pending";
};

const execStatusKind = (status) => {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED") return "failed";
  if (status === "SKIPPED") return "cancelled";
  return "pending";
};

export function ScheduleDetailModal({ id, onClose, onChanged, onSelectJob, notify }) {
  const [schedule, setSchedule] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editCron, setEditCron] = useState("");
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [editMisfire, setEditMisfire] = useState("SKIP");
  const [editPriority, setEditPriority] = useState(0);

  const load = useCallback(async () => {
    try {
      const [schedRes, execRes] = await Promise.all([
        api.schedule(id),
        api.scheduleExecutions(id, 1, 10),
      ]);
      const s = schedRes.schedule;
      setSchedule(s);
      setExecutions(execRes.executions || []);
      setEditName(s.name || "");
      setEditCron(s.cronExpression || "");
      setEditTimezone(s.timezone || "UTC");
      setEditMisfire(s.misfirePolicy || "SKIP");
      setEditPriority(s.priority ?? 0);
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (actionFn, msg, closeAfter = false) => {
    setBusy(true);
    try {
      await actionFn(id);
      notify(msg);
      onChanged?.();
      if (closeAfter) {
        onClose();
      } else {
        await load();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setEditError("");
    try {
      const updates = {
        name: editName,
        misfirePolicy: editMisfire,
        priority: Number(editPriority),
        ...(schedule.scheduleType === "RECURRING"
          ? { cronExpression: editCron, timezone: editTimezone }
          : {}),
      };
      await api.updateSchedule(id, updates);
      notify("Schedule updated.");
      setEditing(false);
      onChanged?.();
      await load();
    } catch (err) {
      setEditError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(schedule.scheduleId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      notify("Could not copy ID", "error");
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="sched-detail-title">
        <div className="drawer-header">
          <div>
            <div className="eyebrow">
              <span className="terminal-dot" /> SCHEDULE DETAILS
            </div>
            <h2 id="sched-detail-title">{schedule?.name || shortId(id)}</h2>
          </div>
          <div className="drawer-header-actions">
            <kbd className="shortcut-badge">ESC</kbd>
            <button className="icon-button bordered" onClick={onClose} title="Close drawer (Esc)">
              <X size={17} />
            </button>
          </div>
        </div>

        {error ? (
          <ErrorPanel message={error} />
        ) : !schedule ? (
          <LoadingRows />
        ) : (
          <>
            <div className="drawer-status">
              <span className={`status status-${scheduleStatusKind(schedule.status)}`}>
                <i />
                {schedule.status}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="icon-button" title="Copy schedule ID" onClick={copyId}>
                  {copiedId ? <Check size={14} /> : <Copy size={15} />}
                </button>
                {["ACTIVE", "PAUSED"].includes(schedule.status) && (
                  <button
                    className="icon-button"
                    title={editing ? "Cancel edit" : "Edit schedule"}
                    onClick={() => {
                      setEditError("");
                      setEditing((v) => !v);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>

            {editing ? (
              <form onSubmit={saveEdit} className="form-stack" style={{ marginBottom: 16 }}>
                <Field label="Schedule name">
                  <input required value={editName} onChange={(e) => setEditName(e.target.value)} />
                </Field>
                {schedule.scheduleType === "RECURRING" && (
                  <div className="form-row-2">
                    <Field label="Cron expression">
                      <input
                        required
                        value={editCron}
                        onChange={(e) => setEditCron(e.target.value)}
                      />
                    </Field>
                    <Field label="Timezone">
                      <select
                        value={editTimezone}
                        onChange={(e) => setEditTimezone(e.target.value)}
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                <div className="form-row-2">
                  <Field label="Misfire policy">
                    <select value={editMisfire} onChange={(e) => setEditMisfire(e.target.value)}>
                      <option value="SKIP">SKIP</option>
                      <option value="RUN_ONCE">RUN_ONCE</option>
                    </select>
                  </Field>
                  <Field label="Priority">
                    <input
                      type="number"
                      min="0"
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                    />
                  </Field>
                </div>
                {editError && <InlineError>{editError}</InlineError>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="button primary small" disabled={busy}>
                    Save changes
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="detail-grid">
                <DetailField label="Schedule ID" value={schedule.scheduleId} mono />
                <DetailField label="Type" value={schedule.scheduleType} />
                <DetailField
                  label="Cron / Run At"
                  value={
                    schedule.scheduleType === "RECURRING"
                      ? schedule.cronExpression
                      : fmtDate(schedule.runAt)
                  }
                  mono
                />
                <DetailField label="Timezone" value={schedule.timezone || "UTC"} />
                <DetailField label="Next Run" value={fmtDate(schedule.nextRunAt)} />
                <DetailField label="Last Run" value={fmtDate(schedule.lastRunAt)} />
                <DetailField label="Run Count" value={schedule.runCount ?? 0} />
                <DetailField label="Failures" value={schedule.failureCount ?? 0} />
                <DetailField label="Misfire Policy" value={schedule.misfirePolicy} />
                <DetailField label="Last Job ID" value={schedule.lastJobId} mono />
              </div>
            )}

            <div className="payload-block">
              <div>
                <span>PAYLOAD</span>
              </div>
              <pre>{JSON.stringify(schedule.payload || {}, null, 2)}</pre>
            </div>

            <div className="payload-block">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>RECENT EXECUTIONS ({executions.length})</span>
                <button className="icon-button" title="Refresh executions" onClick={load}>
                  <RefreshCw size={13} />
                </button>
              </div>
              {executions.length === 0 ? (
                <p className="muted" style={{ padding: "8px 0", fontSize: "13px" }}>
                  No executions recorded yet.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Triggered</th>
                        <th>Status</th>
                        <th>Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((ex) => (
                        <tr key={ex._id}>
                          <td style={{ fontSize: "12px" }}>{fmtDate(ex.triggeredAt)}</td>
                          <td>
                            <span className={`status status-${execStatusKind(ex.status)}`}>
                              <i />
                              {ex.status}
                            </span>
                          </td>
                          <td>
                            {ex.jobId ? (
                              <button
                                className="text-button mono"
                                style={{ fontSize: "12px" }}
                                onClick={() => {
                                  onClose();
                                  onSelectJob?.(ex.jobId);
                                }}
                              >
                                {shortId(ex.jobId)}
                              </button>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="drawer-footer" style={{ display: "flex", gap: 8 }}>
              {schedule.status === "ACTIVE" && (
                <>
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() => handleAction(api.pauseSchedule, "Schedule paused.")}
                  >
                    {busy ? <LoaderCircle size={14} className="spin" /> : <Pause size={14} />} Pause
                  </button>
                  <button
                    className="button danger full"
                    disabled={busy}
                    onClick={() => handleAction(api.cancelSchedule, "Schedule cancelled.")}
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              )}
              {schedule.status === "PAUSED" && (
                <>
                  <button
                    className="button primary full"
                    disabled={busy}
                    onClick={() => handleAction(api.resumeSchedule, "Schedule resumed.")}
                  >
                    {busy ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />} Resume
                  </button>
                  <button
                    className="button danger full"
                    disabled={busy}
                    onClick={() => handleAction(api.cancelSchedule, "Schedule cancelled.")}
                  >
                    <X size={14} /> Cancel
                  </button>
                </>
              )}
              {["COMPLETED", "CANCELLED"].includes(schedule.status) && (
                <button
                  className="button danger full"
                  disabled={busy}
                  onClick={() => handleAction(api.deleteSchedule, "Schedule deleted.", true)}
                >
                  <Trash2 size={14} /> Delete schedule
                </button>
              )}
              {!["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"].includes(schedule.status) && (
                <span className="footnote">
                  <Shield size={13} /> No actions available.
                </span>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default ScheduleDetailModal;
