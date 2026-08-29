import React, { useState } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  RefreshCw,
  XCircle,
  Code,
  ShieldCheck,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { StatusBadge, Copyable, formatDateTime, formatRelative } from './ui';
import { useCancelJob, useRetryDeadJob } from '../hooks/useQueries';
import { useUI } from '../context/UIContext';
import { getErrorMessage } from '../api/client';

export default function JobDetailDrawer({ job, onClose }) {
  const { showToast } = useUI();
  const cancelJob = useCancelJob();
  const retryJob = useRetryDeadJob();
  const [pendingAction, setPendingAction] = useState(null);

  if (!job) return null;

  const isDeadOrFailed = job.status === 'DEAD' || job.status === 'FAILED';

  const formatDate = (iso) => formatDateTime(iso);
  const errorText =
    typeof job.error === 'object' ? JSON.stringify(job.error, null, 2) : String(job.error || '');

  const handleCancel = async () => {
    setPendingAction('cancel');
    try {
      await cancelJob.mutateAsync(job.jobId);
      showToast(`Job ${job.jobId} cancelled successfully`);
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to cancel job'), 'error');
      setPendingAction(null);
    }
  };

  const handleRetry = async () => {
    setPendingAction('retry');
    try {
      await retryJob.mutateAsync(job.jobId);
      showToast(`Job ${job.jobId} re-queued for processing!`);
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to retry dead job'), 'error');
      setPendingAction(null);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="drawer-title-row">
              <h3>Job Inspector</h3>
              <StatusBadge status={job.status} />
            </div>
            <div className="drawer-sub">
              <Copyable text={job.jobId} />
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">Job Type</span>
              <strong>{job.type}</strong>
            </div>
            <div className="meta-item">
              <span className="meta-label">Priority</span>
              <strong className="accent">P{job.priority ?? 0}</strong>
            </div>
            <div className="meta-item">
              <span className="meta-label">Attempts</span>
              <strong>{job.attempts ?? 0} / {job.maxAttempts ?? 3}</strong>
            </div>
            <div className="meta-item">
              <span className="meta-label">Idempotency</span>
              <span className={`inline-status ${job.idempotencyKey ? 'success' : 'faint'}`}>
                {job.idempotencyKey ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                {job.idempotencyKey ? 'Protected' : 'None'}
              </span>
            </div>
          </div>

          <div className="drawer-section">
            <h4><Clock size={15} /> Execution Timeline</h4>
            <div className="timeline">
              <div className="timeline-row">
                <span>Created</span>
                <span>{formatDate(job.createdAt)} <span className="faint timeline-relative">({formatRelative(job.createdAt)})</span></span>
              </div>
              {job.startedAt && (
                <div className="timeline-row">
                  <span>Started</span>
                  <span>{formatDate(job.startedAt)}</span>
                </div>
              )}
              {job.completedAt && (
                <div className="timeline-row success">
                  <span><CheckCircle2 size={13} className="text-icon" /> Completed</span>
                  <span>{formatDate(job.completedAt)}</span>
                </div>
              )}
              {job.failedAt && (
                <div className="timeline-row danger">
                  <span><AlertTriangle size={13} className="text-icon" /> Failed</span>
                  <span>{formatDate(job.failedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {job.error && (
            <div className="drawer-section">
              <h4 className="danger"><AlertTriangle size={15} /> Error Diagnostic</h4>
              <pre className="error-trace">{errorText}</pre>
            </div>
          )}

          <div className="drawer-section">
            <h4><Code size={15} /> Job Payload</h4>
            <pre className="payload-view">{JSON.stringify(job.payload || {}, null, 2)}</pre>
          </div>

          {job.idempotencyKey && (
            <div className="drawer-section no-margin">
              <h4><ShieldCheck size={15} /> Idempotency Key</h4>
              <Copyable text={job.idempotencyKey} display={job.idempotencyKey} />
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {job.status === 'PENDING' && (
            <button className="btn btn-danger" onClick={handleCancel} disabled={pendingAction !== null}>
              {pendingAction === 'cancel' ? <RefreshCw size={16} className="spin-icon" /> : <XCircle size={16} />}
              {pendingAction === 'cancel' ? 'Cancelling...' : 'Cancel Job'}
            </button>
          )}
          {isDeadOrFailed && (
            <button className="btn btn-primary" onClick={handleRetry} disabled={pendingAction !== null}>
              {pendingAction === 'retry' ? <RefreshCw size={16} className="spin-icon" /> : <RefreshCw size={16} />}
              {pendingAction === 'retry' ? 'Re-queuing...' : 'Re-enqueue to Queue'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
