import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { ErrorPanel, PageHeading, StatusDropdown } from "./Common";
import { JobsTable, Pagination } from "./JobsTable";
import { useSocket } from "../context/SocketContext";

export function JobsView({ onSelectJob, onCreate, notify }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState("");

  const { socket } = useSocket();

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .jobs(page, 10, status)
      .then(setData)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Live real-time updates from WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleJobUpdated = (payload) => {
      setData((prev) => {
        if (!prev?.jobs) return prev;
        const exists = prev.jobs.some((j) => j.jobId === payload.jobId);
        if (!exists) {
          // If a new job was enqueued and we are on page 1, reload in background
          if (page === 1 && (!status || status === payload.status)) {
            api.jobs(page, 10, status).then(setData).catch(() => {});
          }
          return prev;
        }

        return {
          ...prev,
          jobs: prev.jobs.map((job) => {
            if (job.jobId !== payload.jobId) return job;
            return {
              ...job,
              status: payload.status || job.status,
              attempts: payload.attempts !== undefined ? payload.attempts : job.attempts,
              completedAt: payload.completedAt || job.completedAt,
              error: payload.error ? { message: payload.error } : job.error,
            };
          }),
        };
      });
    };

    socket.on("job:updated", handleJobUpdated);
    return () => {
      socket.off("job:updated", handleJobUpdated);
    };
  }, [socket, page, status]);


  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 10)));

  const retry = async (event, id) => {
    event.stopPropagation();
    setRetryingId(id);
    try {
      await api.retryJob(id);
      notify("Job re-queued for processing.");
      load();
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setRetryingId("");
    }
  };

  const filteredJobs = (data?.jobs || []).filter((j) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      j.jobId?.toLowerCase().includes(q) ||
      j.type?.toLowerCase().includes(q) ||
      j.payload?.to?.toLowerCase().includes(q) ||
      j.payload?.subject?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeading
        eyebrow="QUEUE"
        title="Jobs"
        description="Inspect, filter, and manage distributed jobs in real-time."
        action={
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create job
          </button>
        }
      />
      <section className="panel list-panel">
        <div className="list-toolbar">
          <div className="search-input-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search this page by ID or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                style={{ width: 20, height: 20 }}
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <StatusDropdown
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />

          <div className="toolbar-right">
            <span>
              {data
                ? search.trim()
                  ? `${filteredJobs.length} shown on this page · ${data.total} total`
                  : `${data.total} jobs`
                : "Loading jobs"}
            </span>
            {(search || status) && (
              <button
                className="text-button clear-filters"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
            <button
              className="icon-button bordered"
              onClick={load}
              title="Refresh"
              aria-label="Refresh jobs"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <JobsTable
            jobs={filteredJobs}
            loading={loading}
            onSelect={onSelectJob}
            empty="No jobs match your filter criteria."
            emptyDescription={
              data?.total
                ? "Try a different search or status, or clear the current filters."
                : "Create a job to see it appear here."
            }
            action={(job) =>
              ["FAILED", "DEAD"].includes(job.status) ? (
                <button
                  className="button small"
                  disabled={retryingId === job.jobId}
                  onClick={(e) => retry(e, job.jobId)}
                >
                  {retryingId === job.jobId ? (
                    <LoaderCircle size={12} className="spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}{" "}
                  {retryingId === job.jobId ? "Retrying" : "Retry"}
                </button>
              ) : (
                <span className="priority">{job.priority ?? 0}</span>
              )
            }
          />
        )}
        <Pagination
          page={page}
          pages={pages}
          total={data?.total || 0}
          limit={data?.limit || 10}
          onChange={setPage}
        />
      </section>
      <p className="footnote">
        <Shield size={13} /> Multi-tenant isolated queue. Cancel pending jobs or
        retry failed items with idempotency protection.
      </p>
    </>
  );
}

export default JobsView;
