import { useEffect, useMemo, useState } from "react";

import { Badge, Card, CardBody } from "../components/ui/Card.jsx";
import { Alert, EmptyState, Skeleton } from "../components/ui/Feedback.jsx";
import { Button } from "../components/ui/Button.jsx";
import { CopyableValue } from "../components/ui/Code.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { monitoring } from "../lib/api/endpoints.js";
import { useConfig } from "../context/ConfigContext.jsx";
import { useLiveState } from "../context/LiveContext.jsx";
import {
  formatDuration,
  formatRelative,
  healthLabel,
  healthTone,
  toDate,
} from "./jobFormat.js";

/**
 * Workers view.
 *
 * Reads from the live store first so the list updates with the dashboard, and
 * only fetches separately when the store has no worker data at all. That
 * avoids a second request on every poll tick while still working if the
 * overview endpoint is unavailable.
 */
export function WorkersView() {
  const live = useLiveState();
  const { config, apiConfigAvailable } = useConfig();

  const [fallback, setFallback] = useState({ workers: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const storeWorkers = live.overview?.workers;

  useEffect(() => {
    // Only fetch when the overview has not supplied worker data.
    if (storeWorkers) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    monitoring
      .workers({ signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setFallback({
          workers: data?.workers ?? [],
          count: data?.activeWorkerCount ?? (data?.workers ?? []).length,
        });
        setError(null);
      })
      .catch((caught) => {
        if (cancelled || caught?.kind === "aborted") return;
        setError(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [storeWorkers]);

  const workers = storeWorkers?.workers ?? fallback.workers;
  const count = storeWorkers?.activeWorkerCount ?? fallback.count;

  const health = useMemo(() => {
    const tally = { success: 0, warning: 0, danger: 0, neutral: 0 };
    for (const worker of workers) tally[healthTone(worker.health)] += 1;
    return tally;
  }, [workers]);

  const isLoading = loading || (live.status === "loading" && !storeWorkers && !fallback.workers.length);

  return (
    <>
      <div className="page__head">
        <div className="page__heading">
          <h2 className="page__title">Workers</h2>
          <p className="page__lede">
            Processes that consume from the queue. A worker registers a heartbeat in Redis; the console
            treats a heartbeat older than {config.heartbeatTtlSeconds}s as stale.
          </p>
        </div>
        <div className="page__actions">
          <Badge tone={live.transport === "sse" ? "success" : "neutral"} dot>
            {live.transport === "sse" ? "Live" : "Polling"}
          </Badge>
        </div>
      </div>

      <div className="stack">
        {error ? (
          <Alert
            tone="danger"
            title="Could not load workers"
            actions={
              <Button size="sm" variant="secondary" onClick={() => setFallback({ workers: [], count: 0 })}>
                Dismiss
              </Button>
            }
          >
            {error.displayMessage}
          </Alert>
        ) : null}

        {count > 0 ? (
          <div className="row" style={{ gap: "var(--space-2)" }}>
            {health.success > 0 ? (
              <Badge tone="success" dot size="lg">
                {health.success} healthy
              </Badge>
            ) : null}
            {health.warning > 0 ? (
              <Badge tone="warning" dot size="lg">
                {health.warning} stale
              </Badge>
            ) : null}
            {health.danger > 0 ? (
              <Badge tone="danger" dot size="lg">
                {health.danger} unresponsive
              </Badge>
            ) : null}
            {apiConfigAvailable === false ? (
              <span className="text-xs text-tertiary">
                Stale threshold is an assumption — the API does not publish its heartbeat TTL.
              </span>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="worker-grid">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} height={190} radius="var(--radius-lg)" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Icons.workers size={22} />}
                title="No workers are running"
                description="Start a worker process (npm run worker) and it will register here within one heartbeat interval."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="worker-grid">
            {workers.map((worker, index) => (
              <WorkerCard
                key={worker.id ?? worker.workerId ?? index}
                worker={worker}
                concurrency={config.workerConcurrency}
                concurrencyIsAssumed={config.workerConcurrencySource !== "api"}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function WorkerCard({ worker, concurrency, concurrencyIsAssumed }) {
  const tone = healthTone(worker.health);
  const active = Number(worker.activeJobs ?? worker.currentJobs ?? 0);
  const processed = Number(worker.processedJobs ?? worker.completedJobs ?? 0);
  const failed = Number(worker.failedJobs ?? 0);
  const lastBeat = toDate(worker.lastHeartbeat ?? worker.updatedAt ?? worker.createdAt);

  return (
    <Card className="worker" data-health={String(worker.health ?? "UNKNOWN").toUpperCase()}>
      <div className="worker__head">
        <div className="worker__ident">
          <span className="worker__icon">
            <Icons.workers size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="worker__id">
              <CopyableValue value={worker.id ?? worker.workerId ?? worker.name ?? "worker"} />
            </div>
            <div className="worker__sub">
              <span>{worker.pid ? `pid ${worker.pid}` : "pid unknown"}</span>
              {worker.hostname ? <span>· {worker.hostname}</span> : null}
            </div>
          </div>
        </div>
        <Badge tone={tone} dot>
          {healthLabel(worker.health)}
        </Badge>
      </div>

      <div className="worker__metrics">
        <div className="worker__metric">
          <span className="worker__metric-label">Active</span>
          <span className="worker__metric-value">
            {active}
            {concurrencyIsAssumed ? <span className="text-tertiary"> / {concurrency}</span> : null}
          </span>
        </div>
        <div className="worker__metric">
          <span className="worker__metric-label">Processed</span>
          <span className="worker__metric-value">{processed}</span>
        </div>
        <div className="worker__metric">
          <span className="worker__metric-label">Failed</span>
          <span className="worker__metric-value">{failed}</span>
        </div>
        <div className="worker__metric">
          <span className="worker__metric-label">Last beat</span>
          <span className="worker__metric-value" style={{ fontSize: "var(--text-sm)" }}>
            {lastBeat ? formatRelative(lastBeat) : "—"}
          </span>
        </div>
      </div>

      {worker.uptime != null ? (
        <div className="text-xs text-tertiary">
          Up {formatDuration(Number(worker.uptime) * 1000)}
        </div>
      ) : null}
    </Card>
  );
}
