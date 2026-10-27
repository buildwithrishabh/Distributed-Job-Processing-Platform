import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { ErrorPanel, PageHeading } from "./Common";
import { EmptyState, LoadingRows, Status } from "./JobsTable";

export function WorkerTelemetry() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api
        .workers()
        .then((result) => {
          setData(result);
          setError("");
        })
        .catch((e) => setError(errorText(e))),
    []
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <PageHeading
        eyebrow="INFRASTRUCTURE"
        title="Workers"
        description="Live heartbeat telemetry reported by worker instances."
        action={
          <button className="button secondary" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : (
        <section className="panel list-panel">
          <div className="workers-heading">
            <div>
              <span className="metric-value">
                {data?.activeWorkerCount ?? "—"}
              </span>
              <span className="workers-caption">active workers</span>
            </div>
            <span className="live-label">
              <span className="live-dot" /> Auto-sync · 15s
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>WORKER</th>
                  <th>STATUS</th>
                  <th>HEALTH</th>
                  <th>UPTIME</th>
                  <th>MEMORY</th>
                  <th>LAST SEEN</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr>
                    <td colSpan="6">
                      <LoadingRows />
                    </td>
                  </tr>
                ) : !data.workers?.length ? (
                  <tr>
                    <td colSpan="6">
                      <EmptyState
                        title="No active workers"
                        description="Workers appear here when their Redis heartbeat ping is active."
                        icon={Cpu}
                      />
                    </td>
                  </tr>
                ) : (
                  data.workers.map((worker) => (
                    <tr key={worker.workerId}>
                      <td>
                        <div className="worker-name">
                          <span className="worker-icon">
                            <Cpu size={15} />
                          </span>
                          <div>
                            <strong>{worker.workerId}</strong>
                            <small>PID {worker.pid}</small>
                          </div>
                        </div>
                      </td>
                      <td>{worker.status}</td>
                      <td>
                        <Status value={worker.health} />
                      </td>
                      <td>{Math.floor((worker.uptime || 0) / 60)}m</td>
                      <td>
                        {Math.round(
                          (worker.memoryUsage?.rss || 0) / 1024 / 1024
                        )}{" "}
                        MB
                      </td>
                      <td>{worker.secondsSinceLastSeen}s ago</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="footnote">
        <Activity size={13} /> Heartbeats automatically expire after 30 seconds.
        Memory indicates resident set size (RSS).
      </p>
    </>
  );
}

export default WorkerTelemetry;
