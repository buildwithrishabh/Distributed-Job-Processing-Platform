import React, { useState } from 'react';
import { AlertOctagon, RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { useDeadJobsQuery, useRetryDeadJob } from '../hooks/useQueries';
import { useUI } from '../context/UIContext';
import { getErrorMessage } from '../api/client';
import { TableSkeleton, ErrorState, EmptyState, Copyable, formatDateTime, formatRelative } from './ui';

function errorText(job) {
  if (!job.error) return 'Execution failure';
  if (typeof job.error === 'object') return job.error.message || JSON.stringify(job.error);
  return String(job.error);
}

export default function DLQManager() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const [retryingId, setRetryingId] = useState(null);

  const { openJobDrawer, showToast } = useUI();
  const retryJob = useRetryDeadJob();

  const { data, isLoading, isError, refetch, isFetching } = useDeadJobsQuery({ page, limit });

  const deadJobs = data?.jobs || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleRetry = async (jobId) => {
    setRetryingId(jobId);
    try {
      await retryJob.mutateAsync(jobId);
      showToast(`Job ${jobId} re-queued for processing!`);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to retry dead job'), 'error');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="fade-in">
      <div className="card pad dlq-card">
        <div className="dlq-banner">
          <div className="dlq-banner-left">
            <span className="stat-ico danger">
              <AlertOctagon size={24} />
            </span>
            <div>
              <h2 className="dlq-title">Dead-Letter Queue (DLQ)</h2>
              <p className="dlq-copy">
                Audit jobs moved to the DLQ after exhausting max retries. Re-enqueue safely with atomic locks.
              </p>
            </div>
          </div>
          <span className="dead-count-chip">
            {total} Dead Jobs
          </span>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : isError ? (
        <ErrorState message="Failed to load dead-letter queue" onRetry={refetch} />
      ) : deadJobs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Zero Dead Jobs"
          subtitle="Queue health is 100% optimal. No jobs have exhausted retries into the Dead-Letter Queue."
        />
      ) : (
        <div className="table-card">
          <div className="table-toolbar">
            <span className="chip chip-danger">
              {total} dead jobs recorded
            </span>
            <div className="row-actions">
              <button className="btn btn-secondary btn-sm" onClick={refetch}>
                <RefreshCw size={14} className={isFetching ? 'spin-icon' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Type</th>
                  <th>Failed</th>
                  <th>Attempts</th>
                  <th>Error Diagnostic</th>
                  <th className="align-right">Recovery</th>
                </tr>
              </thead>
              <tbody>
                {deadJobs.map((job) => (
                  <tr key={job._id || job.jobId} className="click-row" onClick={() => openJobDrawer(job)}>
                    <td data-label="Job ID">
                      <Copyable text={job.jobId} display={job.jobId.length > 24 ? `${job.jobId.slice(0, 24)}...` : job.jobId} />
                    </td>
                    <td data-label="Type" className="cell-type">{job.type}</td>
                    <td data-label="Failed" className="cell-muted" title={formatDateTime(job.failedAt)}>
                      {formatRelative(job.failedAt)}
                    </td>
                    <td data-label="Attempts" className="cell-muted">
                      {job.attempts ?? job.maxAttempts}/{job.maxAttempts}
                    </td>
                    <td data-label="Error Diagnostic">
                      <span
                        className="error-pill"
                        title={typeof job.error === 'object' ? JSON.stringify(job.error, null, 2) : job.error}
                      >
                        <Terminal size={13} /> {errorText(job)}
                      </span>
                    </td>
                    <td data-label="Recovery">
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={retryingId === job.jobId}
                          onClick={() => handleRetry(job.jobId)}
                        >
                          <RefreshCw size={14} className={retryingId === job.jobId ? 'spin-icon' : ''} />
                          {retryingId === job.jobId ? 'Locking...' : 'Re-enqueue Job'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {deadJobs.length > 0 && (
            <div className="pagination">
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <span className="pagination-btns">
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={15} /> Prev
                </button>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight size={15} />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
