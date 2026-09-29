import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge, Card, CardBody, CardHeader, StatusPill } from "../components/ui/Card.jsx";
import { Alert, EmptyState, KeyValue, Skeleton } from "../components/ui/Feedback.jsx";
import { Button } from "../components/ui/Button.jsx";
import { CodeBlock, CopyButton, CopyableValue } from "../components/ui/Code.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { jobs as jobsApi } from "../lib/api/endpoints.js";
import {
  errorDetail,
  errorSummary,
  failureAdvice,
  formatDateTime,
  formatDuration,
  isCancellable,
  isPermanentFailure,
  isRetriable,
  jobDuration,
  statusLabel,
  typeColor,
} from "./jobFormat.js";

/**
 * Lifecycle stages, in order. Used to render the progress timeline.
 * `matches` decides which stage a given job status belongs to.
 */
const STAGES = [
  { key: "created", label: "Created", matches: () => true },
  { key: "processing", label: "Processing", matches: (s) => s === "PROCESSING" || s === "COMPLETED" || s === "RETRYING" },
  { key: "completed", label: "Completed", matches: (s) => s === "COMPLETED" },
  { key: "failed", label: "Failed", matches: (s) => s === "FAILED" || s === "DEAD" },
  { key: "dead", label: "Dead letter", matches: (s) => s === "DEAD" },
];

function stageState(stage, job) {
  const status = String(job.status ?? "").toUpperCase();

  // A stage is "done" if a later stage has been reached.
  const order = { PENDING: 0, RETRYING: 0, PROCESSING: 1, COMPLETED: 2, FAILED: 3, DEAD: 4, CANCELLED: 3 };
  const reached = order[status] ?? 0;
  const stageIndex = STAGES.indexOf(stage);

  if (status === "CANCELLED") {
    if (stageIndex === 0) return "done";
    if (stageIndex === 1) return "error";
    return "muted";
  }
  if (!stage.matches(status)) return "muted";
  if (stageIndex === reached) {
    if (status === "DEAD") return "error";
    if (status === "COMPLETED") return "done";
    return status === "PROCESSING" ? "active" : "done";
  }
  return stageIndex < reached ? "done" : "muted";
}

function Timeline({ job }) {
  return (
    <div className="timeline">
      {STAGES.map((stage, index) => {
        const state = stageState(stage, job);
        return (
          <div key={stage.key} style={{ display: "contents" }}>
            {index > 0 ? (
              <span
                className="timeline__connector"
                data-state={state === "done" ? "done" : state === "error" ? "error" : undefined}
              />
            ) : null}
            <div className="timeline__step" data-state={state}>
              <span className="timeline__marker">
                {state === "done" ? (
                  <Icons.check size={14} />
                ) : state === "error" ? (
                  <Icons.close size={14} />
                ) : state === "active" ? (
                  <Icons.activity size={14} />
                ) : (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                )}
              </span>
              <span className="timeline__label">{stage.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function JobDetailView() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    jobsApi
      .byId(jobId, { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        // Some handlers return the doc bare, others wrap it.
        setJob(data?.job ?? data);
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
  }, [jobId]);

  const act = async (action, successMessage) => {
    setBusy(true);
    try {
      const result = action === "cancel" ? await jobsApi.cancel(jobId) : await jobsApi.retry(jobId);

      // Requeueing always "succeeds" at the API level, so a green toast here is
      // a lie when the job is known to fail again on its first attempt. Say so.
      const requeued = action === "retry" && isPermanentFailure(job);
      if (requeued) {
        toast.warning(
          "Requeued, but this will fail again",
          "The processor rejected the payload as invalid. Fix it first, then requeue.",
        );
      } else {
        toast.success(successMessage, jobId);
      }

      const updated = result?.job ?? result;
      if (updated && typeof updated === "object") setJob((prev) => ({ ...prev, ...updated }));
      else setJob((prev) => (prev ? { ...prev, status: action === "cancel" ? "CANCELLED" : "PENDING" } : prev));
    } catch (caught) {
      toast.error("Action failed", caught.displayMessage ?? "The request was rejected.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="stack">
        <Skeleton height={28} width={240} />
        <div className="grid-2">
          <Skeleton height={280} radius="var(--radius-lg)" />
          <Skeleton height={280} radius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  if (error) {
    const missing = error.kind === "notFound";
    return (
      <EmptyState
        icon={<Icons.alert size={22} />}
        title={missing ? "Job not found" : "Could not load this job"}
        description={
          missing
            ? "It may have been removed, or the id in the URL may be incorrect."
            : error.displayMessage
        }
        action={
          <Button variant="primary" onClick={() => navigate("/jobs")} icon={<Icons.chevronLeft size={15} />}>
            Back to jobs
          </Button>
        }
      />
    );
  }

  if (!job) return null;

  const status = String(job.status ?? "PENDING").toUpperCase();
  const duration = jobDuration(job);
  const advice = status === "DEAD" || status === "FAILED" ? failureAdvice(job) : null;

  return (
    <>
      <div className="page__head">
        <div className="page__heading">
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              icon={<Icons.chevronLeft size={15} />}
            >
              Back
            </Button>
            <StatusPill status={status} live={status === "PROCESSING"} />
            {status === "CANCELLED" ? <Badge tone="neutral">Terminal</Badge> : null}
          </div>
          <h2 className="page__title mono" style={{ wordBreak: "break-all" }}>
            {job.type ?? "Unknown job"}
          </h2>
          <p className="page__lede">
            <CopyableValue value={job.jobId} />
          </p>
        </div>

        <div className="page__actions">
          {isCancellable(status) ? (
            <Button
              variant="danger"
              onClick={() => act("cancel", "Job cancelled")}
              loading={busy}
              icon={<Icons.close size={15} />}
            >
              Cancel job
            </Button>
          ) : null}
          {isRetriable(status) ? (
            <Button
              variant="success"
              onClick={() => act("retry", "Job requeued")}
              loading={busy}
              icon={<Icons.retry size={15} />}
            >
              Requeue
            </Button>
          ) : null}
        </div>
      </div>

      <div className="stack">
        {advice ? (
          <Alert tone={advice.tone} title={advice.title} icon={<Icons.alert size={16} />}>
            {advice.body}
            {job.error?.message ? (
              <>
                {" "}
                <strong>The processor said:</strong>{" "}
                <code className="mono">{errorSummary(job.error, 160)}</code>
              </>
            ) : null}
          </Alert>
        ) : null}

        <Card>
          <CardBody>
            <Timeline job={job} />
          </CardBody>
        </Card>

        <div className="grid-2">
          <Card>
            <CardHeader title="Details" icon={<Icons.info size={15} />} />
            <CardBody>
              <KeyValue
                items={[
                  {
                    key: "Status",
                    value: <StatusPill status={status} live={status === "PROCESSING"} />,
                  },
                  {
                    key: "Type",
                    value: (
                      <span className="job-type">
                        <span className="job-type__dot" style={{ background: typeColor(job.type) }} />
                        <span className="job-type__name">{job.type ?? "—"}</span>
                      </span>
                    ),
                  },
                  {
                    key: "Attempts",
                    value: (
                      <span className="mono">
                        {job.attempts ?? 0} of {job.maxAttempts ?? 3}
                      </span>
                    ),
                  },
                  { key: "Duration", value: <span className="mono">{formatDuration(duration)}</span> },
                  { key: "Created", value: <span className="mono">{formatDateTime(job.createdAt)}</span> },
                  { key: "Started", value: <span className="mono">{formatDateTime(job.startedAt)}</span> },
                  { key: "Finished", value: <span className="mono">{formatDateTime(job.completedAt ?? job.failedAt)}</span> },
                  {
                    key: "Idempotency",
                    value: job.idempotencyKey ? (
                      <CopyableValue value={job.idempotencyKey} />
                    ) : (
                      <span className="text-tertiary">not recorded</span>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Result"
              subtitle={status === "COMPLETED" ? "Processed successfully" : "Latest failure detail"}
              icon={<Icons.alert size={15} />}
            />
            <CardBody>
              {job.error ? (
                <div className="stack">
                  <Alert tone="danger" title={errorSummary(job.error, 120)}>
                    The most recent attempt failed. Retrying the job will re-run the handler with the same
                    payload.
                  </Alert>
                  <CodeBlock value={errorDetail(job.error)} language="text" danger />
                </div>
              ) : status === "COMPLETED" ? (
                <div className="stack">
                  <Alert tone="success" title="Completed without errors">
                    The handler returned successfully after {job.attempts ?? 1}{" "}
                    {(job.attempts ?? 1) === 1 ? "attempt" : "attempts"} in{" "}
                    {formatDuration(duration)}.
                  </Alert>
                  {job.result ? <CodeBlock value={job.result} language="json" /> : null}
                </div>
              ) : (
                <div className="stack">
                  <Alert tone="info" title={`Job is ${statusLabel(status).toLowerCase()}`}>
                    {status === "PENDING"
                      ? "Waiting for a worker to pick it up. No result yet."
                      : "This job has not produced a result yet."}
                  </Alert>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Payload"
            subtitle="Exactly what the handler receives as its argument"
            icon={<Icons.code size={15} />}
            actions={<CopyButton value={job.payload} label="Copy payload" />}
          />
          <CardBody>
            <CodeBlock value={job.payload ?? {}} language="json" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Raw record"
            subtitle="The unfiltered document as stored by the API"
            icon={<Icons.layers size={15} />}
            actions={<CopyButton value={job} label="Copy record" />}
          />
          <CardBody>
            <CodeBlock value={job} language="json" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
