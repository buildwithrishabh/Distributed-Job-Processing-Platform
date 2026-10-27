import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Search,
} from "lucide-react";
import { fmtDate, shortId } from "../utils";

export function Status({ value }) {
  const kind = (value || "unknown").toLowerCase();
  return (
    <span className={`status status-${kind}`}>
      <i />
      {value || "UNKNOWN"}
    </span>
  );
}

export function LoadingRows() {
  return (
    <div className="loading-state">
      <LoaderCircle size={16} className="spin" /> Loading data…
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon }) {
  return (
    <div className="empty-state">
      <div>
        <Icon size={18} />
      </div>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export function Pagination({ page, pages, total, limit, onChange }) {
  if (!total || total <= limit || pages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <span>
        Showing {total ? (page - 1) * limit + 1 : 0}–
        {Math.min(page * limit, total)} of {total}
      </span>
      <div>
        <button
          className="icon-button bordered"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={14} />
        </button>
        <span>
          Page <b>{page}</b> of {pages}
        </span>
        <button
          className="icon-button bordered"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function JobsTable({ jobs, loading, onSelect, empty, emptyDescription, action }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>JOB</th>
            <th>TYPE</th>
            <th>STATUS</th>
            <th>ATTEMPTS</th>
            <th>CREATED</th>
            <th>{action ? "ACTION" : "PRIORITY"}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="6">
                <LoadingRows />
              </td>
            </tr>
          ) : !jobs?.length ? (
            <tr>
              <td colSpan="6">
                <EmptyState
                  title={empty}
                  description={emptyDescription || "No jobs are available yet."}
                  icon={Search}
                />
              </td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr
                key={job.jobId}
                className="clickable-row"
                tabIndex={0}
                aria-label={`Open job ${job.jobId}`}
                onClick={() => onSelect(job.jobId)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(job.jobId);
                  }
                }}
              >
                <td>
                  <div className="job-id">
                    <span className="job-icon">
                      {job.type === "email" ? "@" : "J"}
                    </span>
                    <div>
                      <strong>{shortId(job.jobId)}</strong>
                      <small>{job.jobId}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="type-tag">{job.type}</span>
                </td>
                <td>
                  <Status value={job.status} />
                </td>
                <td>
                  <span className="attempts">
                    {job.attempts || 0}
                    <span> / {job.maxAttempts || 3}</span>
                  </span>
                </td>
                <td>{fmtDate(job.createdAt)}</td>
                <td>
                  {action ? action(job) : <span className="priority">{job.priority ?? 0}</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default JobsTable;
