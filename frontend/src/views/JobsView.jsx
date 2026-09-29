import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Alert, EmptyState } from "../components/ui/Feedback.jsx";
import { CopyableValue } from "../components/ui/Code.jsx";
import { DataTable, Pagination } from "../components/ui/Table.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { Input } from "../components/ui/Field.jsx";
import { StatusPill } from "../components/ui/Card.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { jobs as jobsApi } from "../lib/api/endpoints.js";
import { useDebouncedValue } from "../lib/hooks/index.js";
import {
  STATUS_ORDER,
  errorDetail,
  errorSummary,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  isCancellable,
  isPermanentFailure,
  isRetriable,
  jobDuration,
  shortId,
  statusLabel,
  typeColor,
} from "./jobFormat.js";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [{ value: "", label: "All" }, ...STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(s) }))];

/**
 * The main job browser.
 *
 * Filter and page live in the URL query string so a filtered view is
 * shareable and survives a reload or a back-button navigation.
 */
export function JobsView({ deadOnly = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const statusParam = searchParams.get("status") ?? "";
  const pageParam = Number(searchParams.get("page") ?? 1) || 1;
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(search, 320);

  const [state, setState] = useState({ jobs: [], total: 0, totalPages: 1, page: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const abortRef = useRef(null);

  const status = deadOnly ? "DEAD" : statusParam;

  const patchParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === "" || value === 1) {
              if (key === "page") next.delete("page");
              else next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError(null);
      try {
        const data = deadOnly
          ? await jobsApi.deadList({ page: pageParam, limit: PAGE_SIZE, signal })
          : await jobsApi.list({ page: pageParam, limit: PAGE_SIZE, status, signal });
        setState({
          jobs: data?.jobs ?? [],
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          page: data?.page ?? pageParam,
          limit: data?.limit ?? PAGE_SIZE,
        });
      } catch (caught) {
        if (caught?.kind === "aborted") return;
        setError(caught);
      } finally {
        setLoading(false);
      }
    },
    [deadOnly, pageParam, status],
  );

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Client-side text filter. The API has no search parameter, so filtering
  // happens after the page is fetched — which is why the copy says
  // "filtered on this page" rather than implying a server-side search.
  const rows = useMemo(() => {
    const list = state.jobs;
    if (!debouncedSearch.trim()) return list;
    const needle = debouncedSearch.trim().toLowerCase();
    return list.filter(
      (job) =>
        String(job.type ?? "").toLowerCase().includes(needle) ||
        String(job.jobId ?? "").toLowerCase().includes(needle) ||
        String(job.status ?? "").toLowerCase().includes(needle) ||
        JSON.stringify(job.payload ?? {}).toLowerCase().includes(needle),
    );
  }, [state.jobs, debouncedSearch]);

  const counts = useMemo(() => {
    const tally = {};
    for (const job of state.jobs) {
      const key = String(job.status ?? "PENDING").toUpperCase();
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return tally;
  }, [state.jobs]);

  const onCancel = async (job) => {
    setBusyId(job.jobId);
    try {
      await jobsApi.cancel(job.jobId);
      toast.success("Job cancelled", `${shortId(job.jobId)} will not be processed.`);
      load();
    } catch (caught) {
      toast.error("Could not cancel", caught.displayMessage ?? "The request was rejected.");
    } finally {
      setBusyId(null);
    }
  };

  const onRetry = async (job) => {
    setBusyId(job.jobId);
    try {
      await jobsApi.retry(job.jobId);
      // The API always reports success for a requeue, even when the job is
      // known to fail again immediately. Do not imply it worked.
      if (isPermanentFailure(job)) {
        toast.warning(
          "Requeued, but this will fail again",
          "The processor rejected the payload as invalid. Fix it first, then requeue.",
        );
      } else {
        toast.success("Job requeued", `${shortId(job.jobId)} is back in the queue.`);
      }
      load();
    } catch (caught) {
      toast.error("Could not retry", caught.displayMessage ?? "The request was rejected.");
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "type",
        label: "Type",
        render: (job) => (
          <span className="job-type">
            <span className="job-type__dot" style={{ background: typeColor(job.type) }} />
            <span className="job-type__name">{job.type ?? "unknown"}</span>
          </span>
        ),
      },
      {
        key: "id",
        label: "Job ID",
        width: "190px",
        render: (job) => <CopyableValue value={job.jobId} display={shortId(job.jobId, 10, 6)} />,
      },
      {
        key: "status",
        label: "Status",
        width: "130px",
        render: (job) => <StatusPill status={job.status} live={job.status === "PROCESSING"} />,
      },
      {
        key: "attempts",
        label: "Attempts",
        width: "100px",
        align: "right",
        mono: true,
        render: (job) => `${job.attempts ?? 0} / ${job.maxAttempts ?? 3}`,
      },
      {
        key: "duration",
        label: "Duration",
        width: "110px",
        align: "right",
        mono: true,
        render: (job) => formatDuration(jobDuration(job)),
      },
      {
        key: "error",
        label: "Last error",
        render: (job) => {
          const summary = errorSummary(job.error);
          return summary ? (
            <span className="text-xs text-danger truncate" title={errorDetail(job.error)}>
              {summary}
            </span>
          ) : (
            <span className="text-tertiary">—</span>
          );
        },
      },
      {
        key: "created",
        label: "Created",
        width: "150px",
        mono: true,
        render: (job) => (
          <span title={formatDateTime(job.createdAt)}>{formatRelative(job.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "96px",
        align: "right",
        render: (job) => {
          const busy = busyId === job.jobId;
          // Only offer the action that is actually valid for this status, so
          // the UI never shows a button the server will reject.
          if (isCancellable(job.status)) {
            return (
              <span className="table__actions" onClick={(event) => event.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onCancel(job)}
                  loading={busy}
                  icon={<Icons.close size={13} />}
                  aria-label={`Cancel job ${job.jobId}`}
                >
                  Cancel
                </Button>
              </span>
            );
          }
          if (isRetriable(job.status)) {
            return (
              <span className="table__actions" onClick={(event) => event.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onRetry(job)}
                  loading={busy}
                  icon={<Icons.retry size={13} />}
                  aria-label={`Retry job ${job.jobId}`}
                >
                  Retry
                </Button>
              </span>
            );
          }
          return null;
        },
      },
    ],
    [busyId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const emptyState = (
    <EmptyState
      icon={deadOnly ? <Icons.dead size={22} /> : <Icons.inbox size={22} />}
      title={deadOnly ? "The dead letter queue is empty" : "No jobs found"}
      description={
        debouncedSearch
          ? "No job on this page matches your filter. Try a different term or clear the search."
          : deadOnly
            ? "Jobs land here only after exhausting every retry. Nothing has failed permanently."
            : "Submit a job to start filling the queue."
      }
      action={
        debouncedSearch ? (
          <Button variant="secondary" onClick={() => setSearch("")} icon={<Icons.close size={15} />}>
            Clear filter
          </Button>
        ) : null
      }
    />
  );

  return (
    <>
      <div className="page__head">
        <div className="page__heading">
          <h2 className="page__title">{deadOnly ? "Dead letter queue" : "Jobs"}</h2>
          <p className="page__lede">
            {deadOnly
              ? "Jobs that exhausted every retry. Review the cause, fix the underlying issue, then requeue."
              : "Every job on record for this account, newest first."}
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" onClick={() => load()} icon={<Icons.refresh size={15} />} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <Card flush>
        <div className="toolbar">
          <div className="toolbar__grow">
            <Input
              placeholder="Search type, id, status, or payload…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              icon={<Icons.search size={15} />}
              aria-label="Search jobs"
            />
          </div>

          {!deadOnly ? (
            <div className="filter-chips" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((option) => {
                const active = statusParam === option.value;
                const count = option.value ? counts[option.value] : null;
                return (
                  <button
                    key={option.value || "all"}
                    type="button"
                    className="chip"
                    aria-pressed={active}
                    onClick={() => patchParams({ status: option.value, page: 1 })}
                  >
                    {option.label}
                    {count ? <span className="chip__count">{count}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {error ? (
          <div style={{ padding: "var(--space-4) var(--space-5) 0" }}>
            <Alert
              tone="danger"
              title="Could not load jobs"
              actions={
                <Button size="sm" variant="secondary" onClick={() => load()}>
                  Try again
                </Button>
              }
            >
              {error.displayMessage}
            </Alert>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          empty={emptyState}
          onRowClick={(job) => navigate(`/jobs/${encodeURIComponent(job.jobId)}`)}
        />

        <Pagination
          page={state.page}
          totalPages={state.totalPages}
          total={state.total}
          limit={state.limit}
          onPageChange={(next) => patchParams({ page: next })}
          disabled={loading}
        />
      </Card>

      <p className="sr-only" aria-live="polite">
        {loading ? "Loading jobs" : `${formatNumber(state.total)} jobs total.`}
      </p>
    </>
  );
}
