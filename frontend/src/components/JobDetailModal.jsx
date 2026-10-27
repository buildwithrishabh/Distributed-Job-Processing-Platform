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

  useEffect(() => {
    api.job(id).then(setJob).catch((e) => setError(errorText(e)));
  }, [id]);

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
