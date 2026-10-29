import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  Shield,
} from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { ErrorPanel, PageHeading } from "./Common";
import { JobsTable, Pagination } from "./JobsTable";
import { useSocket } from "../context/SocketContext";

export function DeadJobsView({ onSelectJob, notify }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const { socket } = useSocket();

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .deadJobs(page, 10)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates for DLQ
  useEffect(() => {
    if (!socket) return;
    const handleJobUpdated = (payload) => {
      if (payload.status === "DEAD" || payload.status === "RETRYING") {
        load();
      }
    };
    socket.on("job:updated", handleJobUpdated);
    return () => socket.off("job:updated", handleJobUpdated);
  }, [socket, load]);


  async function retry(event, id) {
    event.stopPropagation();
    setBusy(id);
    try {
      await api.retryJob(id);
      notify("Job re-queued for processing.");
      load();
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy("");
    }
  }

  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 10)));

  return (
    <>
      <PageHeading
        eyebrow="RECOVERY"
        title="Dead letter queue"
        description="Review jobs that exhausted retries or failed permanently."
      />
      <section className="panel list-panel">
        <div className="list-toolbar">
          <div className="dlq-note">
            <AlertCircle size={15} />
            <span>Dead jobs can be safely re-queued for another attempt.</span>
          </div>
          <div className="toolbar-right">
            <span>
              {data ? `${data.total} dead jobs` : "Loading"}
              <button className="icon-button bordered" onClick={load} title="Refresh DLQ">
                <RefreshCw size={14} />
              </button>
            </span>
          </div>
        </div>
        {error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <JobsTable
            jobs={data?.jobs || []}
            loading={loading}
            onSelect={onSelectJob}
            empty="Your dead letter queue is empty."
            emptyDescription="Jobs appear here after their retries are exhausted or they fail permanently."
            action={(job) => (
              <button
                className="button small"
                disabled={busy === job.jobId}
                onClick={(e) => retry(e, job.jobId)}
              >
                {busy === job.jobId ? (
                  <LoaderCircle size={12} className="spin" />
                ) : (
                  <RefreshCw size={12} />
                )}{" "}
                Retry
              </button>
            )}
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
        <Shield size={13} /> Retrying resets attempts and returns the job to
        pending in Redis.
      </p>
    </>
  );
}

export default DeadJobsView;
