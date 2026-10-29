import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  LoaderCircle,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import { api } from "../api";
import { errorText, fmtDate, shortId } from "../utils";
import { ErrorPanel } from "./Common";
import { LoadingRows, Status } from "./JobsTable";
import { useSocket } from "../context/SocketContext";

export function DetailField({ label, value, mono }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value ?? "—"}</strong>
    </div>
  );
}

export function JobDetailModal({ id, onClose, onChanged, notify }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [liveProgress, setLiveProgress] = useState(null);

  const { socket, subscribeToJob, unsubscribeFromJob } = useSocket();

  useEffect(() => {
    api.job(id).then(setJob).catch((e) => setError(errorText(e)));
  }, [id]);

  // Fix #4: merged subscribe + listener setup into a single effect.
  // Listeners are registered FIRST, then the job room subscription is emitted,
  // eliminating the race window where an event could arrive between the two
  // previously separate effects.
  // Fix #5: onCompleted re-fetches from the server instead of faking
  // completedAt with the client clock; same for failedAt in onFailed.
  useEffect(() => {
    if (!socket || !id) return;

    const onProgress = (data) => {
      if (data.jobId === id) {
        const val = typeof data.progress === "number" ? data.progress : data.progress?.percent ?? 50;
        setLiveProgress(val);
      }
    };

    const onState = (data) => {
      if (data.jobId === id) {
        setJob((prev) => (prev ? { ...prev, status: data.status } : prev));
        onChanged?.();
      }
    };

    const onCompleted = async (data) => {
      if (data.jobId === id) {
        try {
          // Re-fetch from server to get the real server-side completedAt timestamp
          const updated = await api.job(id);
          setJob(updated);
        } catch {
          // Fallback: apply known fields without a fake client-side timestamp
          setJob((prev) =>
            prev ? { ...prev, status: "COMPLETED", result: data.result } : prev
          );
        }
        setLiveProgress(100);
        onChanged?.();
      }
    };

    const onFailed = async (data) => {
      if (data.jobId === id) {
        try {
          // Re-fetch from server to get the real server-side failedAt timestamp
          const updated = await api.job(id);
          setJob(updated);
        } catch {
          // Fallback: apply known fields without a fake client-side timestamp
          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.status || "FAILED",
                  error: { message: data.reason || "Job failed" },
                }
              : prev
          );
        }
        onChanged?.();
      }
    };

    socket.on("job:progress", onProgress);
    socket.on("job:state", onState);
    socket.on("job:completed", onCompleted);
    socket.on("job:failed", onFailed);

    // Subscribe to the job room AFTER listeners are registered
    subscribeToJob(id);

    return () => {
      socket.off("job:progress", onProgress);
      socket.off("job:state", onState);
      socket.off("job:completed", onCompleted);
      socket.off("job:failed", onFailed);
      unsubscribeFromJob(id);
    };
  }, [socket, id, onChanged, subscribeToJob, unsubscribeFromJob]);

  const copyToClipboard = async (text, type) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(text);
    } catch {
      notify("Could not copy to clipboard. Check browser permissions.", "error");
      return;
    }
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  async function cancel() {
    setBusy(true);
    try {
      await api.cancelJob(id);
      notify("Job cancelled.");
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      await api.retryJob(id);
      notify("Job re-queued for processing.");
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-header">
          <div>
            <div className="eyebrow"><span className="terminal-dot" /> JOB DETAILS</div>
            <h2 id="detail-title">{shortId(id)}</h2>
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
        ) : !job ? (
          <LoadingRows />
        ) : (
          <>
            <div className="drawer-status">
              <Status value={job.status} />
              <button
                className="icon-button"
                title="Copy job ID"
                onClick={() => copyToClipboard(job.jobId, "id")}
              >
                {copiedId ? <Check size={14} /> : <Copy size={15} />}
              </button>
            </div>

            {(job.status === "PROCESSING" || liveProgress !== null) && (
              <div className="live-progress-container">
                <div className="live-progress-header">
                  <span>LIVE EXECUTION PROGRESS</span>
                  <strong>{liveProgress !== null ? `${liveProgress}%` : "In progress..."}</strong>
                </div>
                <div className="live-progress-track">
                  <div
                    className="live-progress-fill"
                    style={{ width: `${liveProgress !== null ? Math.min(100, Math.max(5, liveProgress)) : 50}%` }}
                  />
                </div>
              </div>
            )}

            <div className="detail-grid">
              <DetailField label="Job ID" value={job.jobId} mono />
              <DetailField label="Type" value={job.type} />
              <DetailField
                label="Attempts"
                value={`${job.attempts} / ${job.maxAttempts}`}
              />
              <DetailField label="Priority" value={job.priority} />
              <DetailField label="Created" value={fmtDate(job.createdAt)} />
              <DetailField label="Updated" value={fmtDate(job.updatedAt)} />
              <DetailField label="Started" value={fmtDate(job.startedAt)} />
              <DetailField label="Completed" value={fmtDate(job.completedAt)} />
            </div>

            {job.error?.message && (
              <div className="error-block">
                <span>LAST ERROR</span>
                <p>{job.error.message}</p>
                {job.failedAt && <small>{fmtDate(job.failedAt)}</small>}
              </div>
            )}

            <div className="payload-block">
              <div>
                <span>PAYLOAD</span>
                <button
                  className="icon-button"
                  title="Copy payload"
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(job.payload || {}, null, 2),
                      "payload"
                    )
                  }
                >
                  {copiedPayload ? (
                    <Check size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              <pre>{JSON.stringify(job.payload || {}, null, 2)}</pre>
            </div>

            {job.result && (
              <div className="payload-block">
                <div>
                  <span style={{ color: "var(--green-text)" }}>EXECUTION RESULT</span>
                </div>
                <pre>{typeof job.result === "string" ? job.result : JSON.stringify(job.result, null, 2)}</pre>
              </div>
            )}

            <div className="drawer-footer">
              {job.status === "PENDING" ? (
                <button
                  className="button danger full"
                  disabled={busy}
                  onClick={cancel}
                >
                  {busy ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <X size={14} />
                  )}{" "}
                  Cancel job
                </button>
              ) : ["FAILED", "DEAD"].includes(job.status) ? (
                <button
                  className="button primary full"
                  disabled={busy}
                  onClick={retry}
                >
                  {busy ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}{" "}
                  Retry job
                </button>
              ) : (
                <span className="footnote">
                  <Shield size={13} /> This job has no available state actions.
                </span>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default JobDetailModal;
