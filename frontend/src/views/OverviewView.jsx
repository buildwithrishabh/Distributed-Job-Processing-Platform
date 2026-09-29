import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AreaChart, CapacityMeter, Donut, StatTile } from "../components/ui/Charts.jsx";
import { Badge, Card, CardBody, CardHeader, StatusPill } from "../components/ui/Card.jsx";
import { EmptyState, Skeleton } from "../components/ui/Feedback.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useConfig } from "../context/ConfigContext.jsx";
import { useLive, useLiveState } from "../context/LiveContext.jsx";
import { getHistory } from "../lib/live/metricsStore.js";
import { jobs as jobsApi } from "../lib/api/endpoints.js";
import {
  capacityTone,
  formatNumber,
  formatRelative,
  healthLabel,
  healthTone,
  typeColor,
} from "./jobFormat.js";

const STATUS_SEGMENTS = [
  { key: "COMPLETED", label: "Completed", color: "var(--chart-3)" },
  { key: "PROCESSING", label: "Processing", color: "var(--chart-2)" },
  { key: "PENDING", label: "Pending", color: "var(--chart-4)" },
  { key: "RETRYING", label: "Retrying", color: "var(--chart-5)" },
  { key: "FAILED", label: "Failed", color: "var(--chart-1)" },
  { key: "DEAD", label: "Dead", color: "var(--chart-6)" },
];

function isFresh(lastUpdatedAt) {
  if (!lastUpdatedAt) return false;
  return Date.now() - lastUpdatedAt < 15_000;
}

/** Wraps every tile so a first load shows structure instead of a blank page. */
function Tile({ loading, children }) {
  if (loading) return <Skeleton height={104} radius="var(--radius-lg)" />;
  return children;
}

export function OverviewView() {
  const navigate = useNavigate();
  const { config, apiConfigAvailable } = useConfig();
  const live = useLiveState();
  const { refresh } = useLive();

  const overview = live.overview;
  const queue = overview?.queue ?? {};
  const jobs = overview?.jobs ?? {};
  const workers = overview?.workers ?? {};

  // Re-read the ring buffer on every store tick so the charts animate.
  const history = getHistory();
  const waitingSeries = history.series("waiting");
  const completedSeries = history.series("completed");
  const failedSeries = history.series("failed");
  const deadSeries = history.series("dead");
  const workerSeries = history.series("workers");

  const loading = live.status === "loading" && !overview;

  // Depend on `overview` (stable per store update) rather than the derived
  // `jobs` object, which is a fresh `{}` whenever metrics have not loaded yet.
  const segments = useMemo(
    () =>
      STATUS_SEGMENTS.map((segment) => ({
        ...segment,
        value: Number(overview?.jobs?.[segment.key] ?? 0),
      })),
    [overview],
  );

  const totalJobs = Number(jobs.total ?? segments.reduce((sum, s) => sum + s.value, 0));
  const waiting = Number(queue.waiting ?? 0);
  const active = Number(queue.active ?? 0);
  const capacity = Number(queue.totalInMemory ?? 0);
  const workerCount = Number(workers.activeWorkerCount ?? 0);

  const utilisation = config.maxQueueCapacity > 0 ? waiting / config.maxQueueCapacity : 0;

  if (live.status === "error" && !overview) {
    return (
      <div className="page__head">
        <EmptyState
          icon={<Icons.wifiOff size={22} />}
          title="Cannot reach the API"
          description={
            live.error?.displayMessage ??
            "The dashboard could not load cluster metrics. Check that the backend is running and that the endpoint in Settings is correct."
          }
          action={
            <Button variant="primary" onClick={refresh} icon={<Icons.refresh size={15} />}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="page__head">
        <div className="page__heading">
          <h2 className="page__title">Overview</h2>
          <p className="page__lede">
            Live health of the {config.queueName} queue, worker pool, and job outcomes.
          </p>
        </div>
        <div className="page__actions">
          {overview ? (
            <span className="text-xs text-tertiary">
              Updated {formatRelative(live.lastUpdatedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="stack">
        {/* ---- Headline tiles ---- */}
        <section className="stat-grid" aria-label="Key metrics">
          <Tile loading={loading}>
            <StatTile
              label="Waiting"
              value={formatNumber(waiting)}
              icon={<Icons.inbox size={15} />}
              tone="pending"
              spark={waitingSeries}
              foot={<span>{`${formatNumber(active)} in flight`}</span>}
              onClick={() => navigate("/jobs?status=PENDING")}
            />
          </Tile>
          <Tile loading={loading}>
            <StatTile
              label="Processing"
              value={formatNumber(active)}
              icon={<Icons.activity size={15} />}
              tone="processing"
              spark={active ? undefined : waitingSeries}
              foot={
                <span>
                  {workerCount} {workerCount === 1 ? "worker" : "workers"}
                </span>
              }
              onClick={() => navigate("/jobs?status=PROCESSING")}
            />
          </Tile>
          <Tile loading={loading}>
            <StatTile
              label="Completed"
              value={formatNumber(jobs.COMPLETED ?? 0)}
              icon={<Icons.check size={15} />}
              tone="completed"
              spark={completedSeries}
              onClick={() => navigate("/jobs?status=COMPLETED")}
            />
          </Tile>
          <Tile loading={loading}>
            <StatTile
              label="Failed"
              value={formatNumber(jobs.FAILED ?? 0)}
              icon={<Icons.alert size={15} />}
              tone="failed"
              spark={failedSeries}
              onClick={() => navigate("/jobs?status=FAILED")}
            />
          </Tile>
          <Tile loading={loading}>
            <StatTile
              label="Dead letter"
              value={formatNumber(jobs.DEAD ?? 0)}
              icon={<Icons.dead size={15} />}
              tone="dead"
              spark={deadSeries}
              foot={
                Number(jobs.DEAD ?? 0) > 0 ? (
                  <Link to="/dead-letter" className="text-xs text-danger">
                    Review &amp; retry
                  </Link>
                ) : (
                  <span>All clear</span>
                )
              }
              onClick={() => navigate("/dead-letter")}
            />
          </Tile>
        </section>

        {/* ---- Throughput + distribution ---- */}
        <div className="grid-main-side">
          <Card>
            <CardHeader
              title="Queue depth"
              subtitle={`Backlog over the last ${waitingSeries.length || 0} samples`}
              icon={<Icons.gauge size={15} />}
              actions={
                isFresh(live.lastUpdatedAt) ? (
                  <Badge tone="success" dot>
                    Live
                  </Badge>
                ) : (
                  <Badge tone="warning" dot>
                    Stale
                  </Badge>
                )
              }
            />
            <CardBody>
              <AreaChart
                values={waitingSeries}
                tone="var(--chart-4)"
                label="Jobs waiting"
                unit=" jobs"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Job outcomes"
              subtitle="All jobs on record"
              icon={<Icons.layers size={15} />}
            />
            <CardBody>
              <Donut
                segments={segments}
                centerValue={formatNumber(totalJobs)}
                centerCaption="total"
                onSelect={(key) => navigate(`/jobs?status=${key}`)}
                activeKey={null}
              />
            </CardBody>
          </Card>
        </div>

        {/* ---- Capacity + workers ---- */}
        <div className="grid-main-side">
          <Card>
            <CardHeader
              title="Worker pool"
              subtitle="Heartbeats from the BullMQ worker registry"
              icon={<Icons.workers size={15} />}
              actions={
                <Link to="/workers" className="btn btn--ghost btn--sm">
                  All workers
                  <Icons.chevronRight size={14} />
                </Link>
              }
            />
            <CardBody>
              {loading ? (
                <div className="stack">
                  <Skeleton height={72} radius="var(--radius-md)" />
                  <Skeleton height={72} radius="var(--radius-md)" />
                </div>
              ) : workerCount === 0 ? (
                <EmptyState
                  compact
                  icon={<Icons.workers size={20} />}
                  title="No workers registered"
                  description="Start a worker process to see it appear here and begin draining the queue."
                />
              ) : (
                <div className="stack">
                  <div className="row row--between">
                    <span className="text-sm text-secondary">
                      {workerCount} active {workerCount === 1 ? "worker" : "workers"}
                    </span>
                    <span className="text-xs text-tertiary">
                      Configured concurrency: {config.workerConcurrency}
                      {config.workerConcurrencySource !== "api" ? (
                        <span title={config.workerConcurrencySource}> (assumed)</span>
                      ) : null}
                    </span>
                  </div>
                  <div style={{ width: "100%" }}>
                    <AreaChart
                      values={workerSeries}
                      tone="var(--chart-2)"
                      label="Active workers"
                      showAxis={false}
                    />
                  </div>
                  <ul className="donut__legend" style={{ minWidth: 0 }}>
                    {(workers.workers ?? []).slice(0, 5).map((worker) => (
                      <li className="donut__row" key={worker.id ?? worker.workerId ?? worker.name}>
                        <span
                          className="donut__swatch"
                          style={{
                            background:
                              healthTone(worker.health) === "success"
                                ? "var(--success)"
                                : healthTone(worker.health) === "warning"
                                  ? "var(--warning)"
                                  : "var(--danger)",
                          }}
                        />
                        <span className="donut__name mono">{worker.id ?? worker.workerId ?? "worker"}</span>
                        <span className="donut__value">
                          {worker.processedJobs ?? worker.completedJobs ?? 0}
                        </span>
                        <span className="donut__pct">{healthLabel(worker.health).slice(0, 4)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Queue capacity"
              subtitle={
                apiConfigAvailable === true
                  ? "Reported by the API"
                  : "Estimated — the API does not publish this value"
              }
              icon={<Icons.server size={15} />}
            />
            <CardBody>
              <div className="stack">
                <CapacityMeter
                  value={waiting}
                  max={config.maxQueueCapacity}
                  tone={capacityTone(utilisation)}
                  note={`${formatNumber(capacity)} in Redis`}
                />
                {apiConfigAvailable === false ? (
                  <p className="field__hint">
                    The dashboard assumes a capacity of{" "}
                    <strong>{formatNumber(config.maxQueueCapacity)}</strong>. Set{" "}
                    <code className="mono">VITE_MAX_QUEUE_CAPACITY</code> to match your server, or expose{" "}
                    <code className="mono">GET /api/config</code> so the UI can read it directly.
                  </p>
                ) : null}
                <Link to="/settings" className="btn btn--secondary btn--sm">
                  <Icons.settings size={14} />
                  Configure endpoint
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ---- Recent activity ---- */}
        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Latest 8 jobs across every status"
            icon={<Icons.clock size={15} />}
            actions={
              <Link to="/jobs" className="btn btn--ghost btn--sm">
                All jobs
                <Icons.chevronRight size={14} />
              </Link>
            }
          />
          <CardBody flush>
            {loading ? (
              <div className="stack" style={{ padding: "var(--space-5)" }}>
                <Skeleton height={13} />
                <Skeleton height={13} />
                <Skeleton height={13} />
              </div>
            ) : (
              <RecentJobs />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/**
 * A small recent-activity feed. Kept separate so it can poll independently of
 * the metrics snapshot, which is a different cadence and a different endpoint.
 */
function RecentJobs() {
  const navigate = useNavigate();
  const [rows] = useRecentJobs();

  if (!rows.length) {
    return (
      <EmptyState
        compact
        icon={<Icons.inbox size={20} />}
        title="No jobs yet"
        description="Submit your first job to start populating the dashboard."
      />
    );
  }

  return (
    <ul className="recent-list">
      {rows.map((job) => (
        <li key={job.jobId ?? job._id}>
          <button
            type="button"
            className="recent-list__row"
            onClick={() => navigate(`/jobs/${job.jobId ?? job._id}`)}
          >
            <span className="recent-list__type" style={{ background: typeColor(job.type) }} />
            <span className="recent-list__name">{job.type ?? "unknown"}</span>
            <StatusPill status={job.status} live={job.status === "PROCESSING"} />
            <span className="recent-list__time">{formatRelative(job.createdAt)}</span>
            <Icons.chevronRight size={14} className="text-tertiary" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Polls the most recent jobs on a slower cadence than the metrics endpoint.
 * A quiet failure is deliberate: the page already surfaces connection problems
 * from the metrics store, and duplicating the error state would be noise.
 */
function useRecentJobs() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const load = async () => {
      try {
        const data = await jobsApi.list({ page: 1, limit: 8 });
        if (cancelled) return;
        const list = data?.jobs ?? [];
        setRows(
          [...list]
            .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
            .slice(0, 8),
        );
      } catch {
        // The overview already surfaces a connection error; a quiet failure
        // here is intentional so we do not stack duplicate error states.
      } finally {
        if (!cancelled) timer = setTimeout(load, 15_000);
      }
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return [rows];
}
