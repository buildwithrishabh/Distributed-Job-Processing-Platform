import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Plus,
  Server,
} from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { ErrorPanel, PageHeading, PanelTitle } from "./Common";
import { JobsTable } from "./JobsTable";
import { MetricsCards } from "./MetricsCards";

export function OverviewView({ onNavigate, onCreate, onSelectJob }) {
  const [data, setData] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return Promise.all([api.overview(), api.jobs(1, 6)])
      .then(([overview, list]) => {
        setData(overview);
        setJobs(list);
        setError("");
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  if (error && !data) {
    return (
      <>
        <PageHeading
          eyebrow="OVERVIEW"
          title="Dashboard"
          description="A live view of your distributed background job queue."
          action={
            <button className="button primary" onClick={onCreate}>
              <Plus size={16} /> Create job
            </button>
          }
        />
        <ErrorPanel message={error} onRetry={load} />
      </>
    );
  }

  const stats = data?.jobs;
  const queue = data?.queue;
  const latest = jobs?.jobs || [];

  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Dashboard"
        description="A live view of your distributed background job queue."
        action={
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create job
          </button>
        }
      />

      <MetricsCards stats={stats} />

      <div className="overview-grid">
        <section className="panel queue-panel">
          <PanelTitle
            title="Queue activity"
            subtitle={queue?.queueName || "job-queue"}
            action={
              <span className="live-label">
                <span className="live-dot" /> Live
              </span>
            }
          />
          <div className="queue-main">
            <div className="queue-big">
              <span>{queue?.waiting ?? "—"}</span>
              <small>Waiting to be processed</small>
            </div>
            <div className="queue-mini">
              <span>
                <i className="legend-dot white" /> Active{" "}
                <b>{queue?.active ?? "—"}</b>
              </span>
              <span>
                <i className="legend-dot" /> Delayed{" "}
                <b>{queue?.delayed ?? "—"}</b>
              </span>
            </div>
          </div>
          <div className="queue-bottom">
            <span>Jobs currently tracked in Redis</span>
            <b>{queue?.totalInMemory ?? "—"} total</b>
          </div>
        </section>

        <section className="panel workers-panel">
          <PanelTitle
            title="Workers"
            subtitle="Distributed background workers"
            action={
              <button
                className="text-button"
                onClick={() => onNavigate("workers")}
              >
                View workers <ArrowRight size={14} />
              </button>
            }
          />
          <div className="worker-summary">
            <div className="worker-count">
              <Server size={18} />
              <strong>{data?.workers?.activeWorkerCount ?? "—"}</strong>
              <span>active workers</span>
            </div>
            <div className="worker-spark">
              <Activity size={38} strokeWidth={1.3} />
              <span>Heartbeat sync</span>
            </div>
          </div>
          <div className="queue-bottom">
            <span>Cluster status</span>
            <span className="health-pill">
              <span className="live-dot" />
              {data?.workers?.activeWorkerCount ? "Workers active" : "No active workers"}
            </span>
          </div>
        </section>
      </div>

      <section className="panel recent-panel">
        <PanelTitle
          title="Recent jobs"
          subtitle="The latest jobs processed by your cluster"
          action={
            <button className="text-button" onClick={() => onNavigate("jobs")}>
              View all jobs <ArrowRight size={14} />
            </button>
          }
        />
        <JobsTable
          jobs={latest}
          loading={!jobs}
          onSelect={onSelectJob}
          empty="No jobs have been submitted yet."
          emptyDescription="Create your first job to see its status and processing details here."
        />
      </section>
    </>
  );
}

export default OverviewView;
