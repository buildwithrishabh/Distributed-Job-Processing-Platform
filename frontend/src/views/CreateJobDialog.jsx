import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button.jsx";
import { Alert } from "../components/ui/Feedback.jsx";
import { Checkbox, Input, Select, Textarea } from "../components/ui/Field.jsx";
import { Modal } from "../components/ui/Overlay.jsx";
import { CopyButton } from "../components/ui/Code.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { ApiError } from "../lib/api/errors.js";
import { jobs as jobsApi, newIdempotencyKey } from "../lib/api/endpoints.js";
import { useConfig } from "../context/ConfigContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

/**
 * Job submission dialog.
 *
 * Notes on correctness:
 *   - The payload is edited as text and validated as JSON *before* submit, so
 *     a malformed payload never costs a round trip.
 *   - An idempotency key is generated once per dialog open and reused for
 *     retries, so a double-click or a network retry cannot create two jobs.
 *   - The default job type list is a placeholder — the real types are whatever
 *     the workers subscribe to, and the API does not enumerate them.
 */

const SAMPLE_PAYLOAD = {
  to: "ops@example.com",
  subject: "Nightly digest",
  body: "Everything that ran today, in one message.",
};

function validatePayload(text) {
  if (!text.trim()) return { ok: false, error: "Payload cannot be empty." };
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Payload must be a JSON object." };
    }
    return { ok: true, value: parsed };
  } catch (caught) {
    return { ok: false, error: `Invalid JSON — ${caught.message}` };
  }
}

export function CreateJobDialog({ onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { config } = useConfig();

  const [type, setType] = useState("");
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(SAMPLE_PAYLOAD, null, 2));
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [priority, setPriority] = useState(0);
  const [usePriority, setUsePriority] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  // Stable for the lifetime of the dialog: a retry of the same submission
  // reuses it, a fresh dialog gets a new one.
  const [idempotencyKey] = useState(newIdempotencyKey);

  const payloadCheck = useMemo(() => validatePayload(payloadText), [payloadText]);

  useEffect(() => {
    if (!type && config.jobTypes?.length) setType(config.jobTypes[0].id);
  }, [config.jobTypes, type]);

  const submit = async (event) => {
    event?.preventDefault();
    setError(null);

    if (!type.trim()) {
      setError("Choose a job type.");
      return;
    }
    if (!payloadCheck.ok) {
      setError(payloadCheck.error);
      return;
    }

    setSubmitting(true);
    try {
      const result = await jobsApi.create(
        {
          type: type.trim(),
          payload: payloadCheck.value,
          maxAttempts: Number(maxAttempts) || 3,
          ...(usePriority ? { priority: Number(priority) || 0 } : {}),
        },
        { idempotencyKey },
      );

      const job = result?.job ?? result;
      setCreated(job);
      toast.success("Job submitted", `${type.trim()} is queued for processing.`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.displayMessage
          : "The job could not be submitted. Check the API endpoint in Settings.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Modal
        title="Job queued"
        subtitle="The worker pool will pick it up shortly."
        size="sm"
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                navigate(`/jobs/${encodeURIComponent(created.jobId)}`);
              }}
            >
              View job
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="kv">
            <div className="kv__key">Job ID</div>
            <div className="kv__value">
              <span className="copyable">
                <span className="copyable__text">{created.jobId}</span>
                <CopyButton value={created.jobId} label="Copy id" />
              </span>
            </div>
            <div className="kv__key">Type</div>
            <div className="kv__value mono">{created.type}</div>
            <div className="kv__key">Status</div>
            <div className="kv__value mono">{created.status}</div>
          </div>
          <Alert tone="info">
            The idempotency key <code className="mono">{idempotencyKey}</code> was sent with this
            submission, so retrying will not create a duplicate.
          </Alert>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="New job"
      subtitle="Submit work to the queue."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-job-form"
            loading={submitting}
            icon={<Icons.plus size={15} />}
          >
            Queue job
          </Button>
        </>
      }
    >
      <form id="create-job-form" className="stack" onSubmit={submit} noValidate>
        {error ? (
          <Alert tone="danger" title="Could not submit">
            {error}
          </Alert>
        ) : null}

        {config.jobTypes?.length ? (
          <Select
            label="Job type"
            required
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={config.jobTypes.map((option) => ({ value: option.id, label: option.label }))}
            hint="The handler a worker must be subscribed to in order to process this job."
          />
        ) : (
          <Input
            label="Job type"
            required
            value={type}
            onChange={(event) => setType(event.target.value)}
            placeholder="email"
            hint="Must match the queue name a worker subscribes to."
          />
        )}

        <Textarea
          label="Payload"
          required
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
          rows={9}
          mono
          error={payloadText && !payloadCheck.ok ? payloadCheck.error : null}
          hint={
            payloadCheck.ok
              ? `Valid JSON object with ${Object.keys(payloadCheck.value ?? {}).length} ${
                  Object.keys(payloadCheck.value ?? {}).length === 1 ? "field" : "fields"
                }.`
              : "A JSON object. This is the argument the handler receives."
          }
        />

        <div className="grid-2">
          <Select
            label="Max attempts"
            value={String(maxAttempts)}
            onChange={(event) => setMaxAttempts(event.target.value)}
            options={[1, 2, 3, 5, 8, 10].map((n) => ({ value: String(n), label: String(n) }))}
            hint="Retries before the job moves to the dead letter queue."
          />

          <div className="field">
            <span className="field__label">Priority</span>
            <div className="row" style={{ gap: "var(--space-3)" }}>
              <Checkbox
                label="Override"
                checked={usePriority}
                onChange={(event) => setUsePriority(event.target.checked)}
              />
              <Input
                type="number"
                value={String(priority)}
                onChange={(event) => setPriority(event.target.value)}
                disabled={!usePriority}
                min="0"
                max="100"
                style={{ width: 96 }}
                aria-label="Priority value"
              />
            </div>
            <span className="field__hint">
              Higher runs first. Leave off to use the queue default.
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
