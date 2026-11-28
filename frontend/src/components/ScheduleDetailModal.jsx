import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  LoaderCircle,
  Pause,
  Play,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../api";
import { errorText, fmtDate, shortId } from "../utils";
import { ErrorPanel } from "./Common";
import { DetailField } from "./JobDetailModal";
import { LoadingRows } from "./JobsTable";

export function ScheduleDetailModal({ id, onClose, onChanged, onSelectJob, notify }) {
  const [schedule, setSchedule] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const load = useCallback(async () => {
    try {
      const [schedRes, execRes] = await Promise.all([
        api.schedule(id),
        api.scheduleExecutions(id, 1, 10),
      ]);
      setSchedule(schedRes.schedule);
      setExecutions(execRes.executions || []);
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
              <span className={`badge ${schedule.status === "ACTIVE" ? "COMPLETED" : schedule.status}`}>
                {schedule.status}
              </span>
              <button className="icon-button" title="Copy schedule ID" onClick={copyId}>
                {copiedId ? <Check size={14} /> : <Copy size={15} />}
              </button>
            </div>

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

            <div className="payload-block">
              <div>
                <span>PAYLOAD</span>
              </div>
              <pre>{JSON.stringify(schedule.payload || {}, null, 2)}</pre>
            </div>

            <div className="payload-block">
              <div>
                <span>RECENT EXECUTIONS ({executions.length})</span>
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
                            <span className={`badge ${ex.status}`}>{ex.status}</span>
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
