import { useEffect, useState } from "react";

import { Badge, Button, Card, CardBody, CardHeader, Input, Select } from "../components/ui/index.js";
import { Alert } from "../components/ui/Feedback.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { useConfig } from "../context/ConfigContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { probeHealth } from "../lib/api/client.js";
import { validateOrigin } from "../lib/api/url.js";
import { SOURCE_LABEL } from "../lib/runtime/capabilities.js";

/**
 * Settings.
 *
 * The endpoint field is the important part. Pointing the console at the wrong
 * API is the single most common self-inflicted support problem, so this page
 * tests a candidate endpoint before saving it rather than after.
 */

function CapabilityRow({ available, label, description }) {
  return (
    <div className="capability" data-available={available ? "true" : "false"}>
      <span className="capability__icon">
        {available ? <Icons.check size={13} /> : <Icons.alert size={13} />}
      </span>
      <span>
        <strong>{label}</strong>
        <br />
        {description}
      </span>
    </div>
  );
}

export function SettingsView() {
  const { origin, originLabel, setOrigin, resetOrigin, config, apiConfigAvailable, theme, setTheme } = useConfig();
  const { user } = useAuth();
  const toast = useToast();

  const [draft, setDraft] = useState(origin);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState(null);

  // Retest whenever the saved endpoint changes.
  useEffect(() => {
    let cancelled = false;
    setProbe(null);
    probeHealth()
      .then((result) => {
        if (!cancelled) setProbe(result);
      })
      .catch(() => {
        if (!cancelled) setProbe({ online: false });
      });
    return () => {
      cancelled = true;
    };
  }, [origin]);

  const validate = () => {
    const result = validateOrigin(draft);
    if (!result.ok) {
      setError(result.reason);
      return null;
    }
    setError(null);
    // `""` is a valid result meaning "same origin" — only `null` is a failure.
    return result.origin;
  };

  const testDraft = async () => {
    const candidate = validate();
    if (candidate === null) return;
    setTesting(true);
    const result = await probeHealthFor(candidate);
    setTesting(false);

    if (result.online) {
      setProbe({ ...result, tested: candidate });
      toast.success("Endpoint reachable", `${describeCandidate(candidate)} responded to /health.`);
    } else {
      setProbe({ ...result, tested: candidate });
      toast.error("Endpoint unreachable", describeCandidate(candidate));
    }
  };

  const save = () => {
    const candidate = validate();
    if (candidate === null) return;
    const result = setOrigin(candidate);
    if (result.ok) {
      toast.success("Endpoint saved", "The console will reload data from the new location.");
    } else {
      setError(result.reason);
    }
  };

  return (
    <>
      <div className="page__head">
        <div className="page__heading">
          <h2 className="page__title">Settings</h2>
          <p className="page__lede">
            Connection settings for this browser. Nothing here is sent anywhere except the API you point
            it at.
          </p>
        </div>
      </div>

      <div className="stack">
        {/* ---- Endpoint ---- */}
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">API endpoint</span>
              <span className="settings-row__hint">
                Where the console sends requests. Must be an http:// or https:// origin. Cross-origin
                requests need CORS enabled on the server.
              </span>
            </div>
            <div className="settings-row__control" style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--space-2)" }}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Leave empty to use this page's origin"
                  mono
                  error={error}
                  icon={<Icons.server size={15} />}
                  aria-label="API endpoint URL"
                  style={{ width: 320 }}
                />
                <Button variant="secondary" onClick={testDraft} loading={testing}>
                  Test
                </Button>
                <Button variant="primary" onClick={save} icon={<Icons.check size={15} />}>
                  Save
                </Button>
              </div>
              <div className="row" style={{ gap: "var(--space-2)" }}>
                <Button variant="ghost" size="xs" onClick={() => setDraft("http://localhost:5000")}>
                  localhost:5000
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setDraft("")}>
                  Use same origin
                </Button>
                <Button variant="ghost" size="xs" onClick={resetOrigin} icon={<Icons.retry size={12} />}>
                  Reset to default
                </Button>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">Connection status</span>
              <span className="settings-row__hint">
                Probed <code className="mono">GET /health</code> on <span className="mono">{originLabel}</span>.
              </span>
            </div>
            <div className="settings-row__control">
              {probe ? (
                <Badge tone={probe.online ? "success" : "danger"} dot>
                  {probe.online ? `Online · ${probe.latency}ms` : "Unreachable"}
                </Badge>
              ) : (
                <Badge tone="neutral" dot>
                  Testing…
                </Badge>
              )}
            </div>
          </div>

          {probe && !probe.online ? (
            <div className="settings-row">
              <Alert tone="danger" title="The API is not responding">
                {probe.error ??
                  `No response from ${origin}. Confirm the server is running and that the port and path are correct.`}
              </Alert>
            </div>
          ) : null}
        </div>

        {/* ---- Runtime capabilities ---- */}
        <Card>
          <CardHeader
            title="Runtime configuration"
            subtitle="Values the dashboard needs but the API does not report directly"
            icon={<Icons.gauge size={15} />}
          />
          <CardBody>
            <div className="stack">
              <Alert tone="info" title="Where these numbers come from">
                The backend does not expose a configuration endpoint, so the console resolves these
                values from an optional <code className="mono">GET /api/config</code>, then from{" "}
                <code className="mono">VITE_*</code> build variables, then from a built-in fallback. The
                source is labelled on each row so an assumption is never mistaken for a fact.
              </Alert>

              <CapabilityRow
                available={apiConfigAvailable === true}
                label="GET /api/config"
                description={
                  apiConfigAvailable === true
                    ? "Available — values below are reported by the API."
                    : "Not implemented on this server. The console falls back to build-time and built-in values."
                }
              />

              <div className="settings-group" style={{ boxShadow: "none" }}>
                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">Queue capacity</span>
                    <span className="settings-row__hint">
                      Maximum jobs the queue will accept before returning 503. Set{" "}
                      <code className="mono">VITE_MAX_QUEUE_CAPACITY</code> to match{" "}
                      <code className="mono">MAX_QUEUE_CAPACITY</code> on the server.
                    </span>
                  </div>
                  <div className="settings-row__control">
                    <span className="mono">{config.maxQueueCapacity.toLocaleString()}</span>
                    <Badge tone={config.maxQueueCapacitySource === "api" ? "success" : "warning"}>
                      {SOURCE_LABEL[config.maxQueueCapacitySource]}
                    </Badge>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">Worker concurrency</span>
                    <span className="settings-row__hint">
                      Jobs each worker runs in parallel. The worker heartbeat does not publish this, so it
                      is estimated from the build configuration.
                    </span>
                  </div>
                  <div className="settings-row__control">
                    <span className="mono">{config.workerConcurrency}</span>
                    <Badge tone={config.workerConcurrencySource === "api" ? "success" : "warning"}>
                      {SOURCE_LABEL[config.workerConcurrencySource]}
                    </Badge>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">Queue name</span>
                    <span className="settings-row__hint">BullMQ queue identifier.</span>
                  </div>
                  <div className="settings-row__control">
                    <span className="mono">{config.queueName}</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">Heartbeat staleness threshold</span>
                    <span className="settings-row__hint">
                      A worker with no heartbeat inside this window is shown as stale.
                    </span>
                  </div>
                  <div className="settings-row__control">
                    <span className="mono">{config.heartbeatTtlSeconds}s</span>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ---- Live transport ---- */}
        <Card>
          <CardHeader
            title="Live updates"
            subtitle="How the dashboard receives new data"
            icon={<Icons.activity size={15} />}
          />
          <CardBody>
            <div className="stack">
              <CapabilityRow
                available={apiConfigAvailable === true ? true : null}
                label="Server-Sent Events"
                description="The console tries to open a stream. If the server does not support it, the stream is closed and the console falls back to periodic polling automatically — no configuration needed."
              />
              <p className="field__hint">
                Transport is chosen at runtime. The connection pill in the top bar always shows which one
                is active, and how long ago the last update arrived.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* ---- Appearance ---- */}
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">Theme</span>
              <span className="settings-row__hint">
                Dark is the default. Your choice is remembered in this browser.
              </span>
            </div>
            <div className="settings-row__control">
              <Select
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                aria-label="Theme"
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">Account</span>
              <span className="settings-row__hint">
                Signed in as <span className="mono">{user?.email}</span>
                {user?.role && user.role !== "user" ? (
                  <>
                    {" "}
                    with the <span className="mono">{user.role}</span> role
                  </>
                ) : null}
                .
              </span>
            </div>
            <div className="settings-row__control">
              <Badge tone="brand">{user?.name ?? "Account"}</Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Health probe against an arbitrary candidate origin (not yet saved). */
async function probeHealthFor(origin) {
  // `origin === ""` means same-origin, so resolve it against this page.
  const base = origin === "" ? window.location.origin : origin;
  const url = `${base.replace(/\/+$/, "")}/health`;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Needed to read a cross-origin health response at all.
      mode: "cors",
      cache: "no-store",
      signal: AbortSignal.timeout ? AbortSignal.timeout(6_000) : undefined,
    });
    const latency = Date.now() - startedAt;
    if (!response.ok) {
      return { online: false, latency, error: `Server responded ${response.status}.` };
    }
    return { online: true, latency };
  } catch (error) {
    return {
      online: false,
      latency: null,
      error:
        error?.name === "TimeoutError"
          ? "No response within 6 seconds."
          : "Could not reach the host. Check the port, and that CORS allows this origin.",
    };
  }
}

function describeCandidate(origin) {
  if (origin === "") return "This page's origin";
  try {
    const url = new URL(origin);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
    return local ? `localhost:${url.port || 80}` : url.host;
  } catch {
    return origin;
  }
}
