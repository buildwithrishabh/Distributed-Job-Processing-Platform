import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from "lucide-react";

export function HelpSupportPage({ onNavigate, onCreate, notify }) {
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (notify) notify("Copied to clipboard!");
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  return (
    <div className="support-center">
      {/* Hero Header */}
      <div className="support-hero">
        <div className="support-hero-badge">
          <Sparkles size={14} />
          <span>SYSTEM ARCHITECTURE &amp; GUIDE</span>
        </div>
        <h1 className="support-hero-title">Distributed Platform Architecture &amp; Guide</h1>
        <p className="support-hero-subtitle">
          An architectural reference explaining the end-to-end background job pipeline,
          worker synchronization, BullMQ queue lifecycles, and cluster operations.
        </p>

        {/* Quick Action Navigation Buttons */}
        <div className="support-hero-actions">
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create test job
          </button>
          <button
            className="button secondary"
            onClick={() => onNavigate && onNavigate("workers")}
          >
            <Users size={15} /> View Active Workers
          </button>
          <button
            className="button secondary"
            onClick={() => onNavigate && onNavigate("overview")}
          >
            <Layers size={15} /> Cluster Overview
          </button>
        </div>
      </div>

      <div className="support-tab-content">
        {/* SECTION 1: SYSTEM ARCHITECTURE & DATA PIPELINE */}
        <section className="panel support-panel">
          <div className="support-section-header">
            <Layers size={20} className="section-icon" />
            <div>
              <h2>System Architecture &amp; Data Pipeline</h2>
              <p>How requests flow from your client application through BullMQ to distributed worker processes</p>
            </div>
          </div>

          <div className="architecture-diagram">
            <div className="arch-step">
              <div className="arch-step-num">1</div>
              <div className="arch-step-box">
                <div className="arch-box-title">Client / Dashboard</div>
                <div className="arch-box-desc">Authenticated REST Request</div>
                <div className="arch-box-badge">Idempotency Key</div>
              </div>
            </div>

            <div className="arch-arrow">
              <span>POST</span>
              <b>→</b>
            </div>

            <div className="arch-step">
              <div className="arch-step-num">2</div>
              <div className="arch-step-box highlighted">
                <div className="arch-box-title">Express API Gateway</div>
                <div className="arch-box-desc">Rate limit, Auth &amp; Validation</div>
                <div className="arch-box-badge">MongoDB Record</div>
              </div>
            </div>

            <div className="arch-arrow">
              <span>Enqueue</span>
              <b>→</b>
            </div>

            <div className="arch-step">
              <div className="arch-step-num">3</div>
              <div className="arch-step-box">
                <div className="arch-box-title">Redis &amp; BullMQ</div>
                <div className="arch-box-desc">Atomic Priority Queue</div>
                <div className="arch-box-badge">Locks &amp; Heartbeats</div>
              </div>
            </div>

            <div className="arch-arrow">
              <span>Consume</span>
              <b>→</b>
            </div>

            <div className="arch-step">
              <div className="arch-step-num">4</div>
              <div className="arch-step-box highlighted">
                <div className="arch-box-title">Distributed Workers</div>
                <div className="arch-box-desc">Autonomous Node.js Processes</div>
                <div className="arch-box-badge">Brevo / Simulation</div>
              </div>
            </div>
          </div>

          <div className="support-grid-2">
            <div className="info-subcard">
              <h4>
                <Database size={16} /> Persistent Storage (MongoDB)
              </h4>
              <p>
                Serves as the durable source of truth. Every job record, status transition, timestamp,
                retry attempt, and failure stack trace is permanently saved to MongoDB. This guarantees
                complete auditability even during Redis restarts or network re-connections.
              </p>
            </div>
            <div className="info-subcard">
              <h4>
                <Zap size={16} /> High-Speed Coordination (Redis)
              </h4>
              <p>
                Powers BullMQ in-memory job queues, distributed locking to avoid double-processing,
                per-user rate limit sliding windows, idempotency deduplication keys, and live worker
                heartbeat registries with 30-second TTL expirations.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: WORKER ARCHITECTURE & CLUSTER COORDINATION */}
        <section className="panel support-panel">
          <div className="support-section-header">
            <Cpu size={20} className="section-icon" />
            <div>
              <h2>Worker Architecture &amp; Distributed Coordination</h2>
              <p>Deep-dive into how background worker nodes operate independently from the API</p>
            </div>
          </div>

          <div className="support-grid-2">
            <div className="info-subcard">
              <h4>
                <Server size={16} /> Decoupled Worker Processes
              </h4>
              <p>
                Workers run as standalone Node.js processes (<code>node src/worker.js</code>) completely separate
                from the Express HTTP API. This decoupling ensures heavy CPU or email workloads never block
                incoming user HTTP requests or dashboard latency.
              </p>
            </div>

            <div className="info-subcard">
              <h4>
                <Clock3 size={16} /> Redis Heartbeat Health Sync
              </h4>
              <p>
                Every worker periodically broadcasts a heartbeat to Redis under <code>worker:heartbeat:&lt;workerId&gt;</code> every
                10 seconds with a 30-second TTL. The monitoring API scans these keys non-blockingly to track active
                cluster nodes in real time.
              </p>
            </div>

            <div className="info-subcard">
              <h4>
                <Lock size={16} /> Distributed Locks &amp; Idempotency
              </h4>
              <p>
                Workers acquire an atomic Redis lock before claiming any job from the queue. This prevents multiple
                concurrent worker replicas from processing the same background task simultaneously.
              </p>
            </div>

            <div className="info-subcard">
              <h4>
                <ShieldCheck size={16} /> Exponential Backoff &amp; DLQ
              </h4>
              <p>
                Failed jobs automatically trigger exponential backoff delays (e.g. 2s, 4s, 8s). If maximum retries
                are exhausted, the job moves to the Dead Letter Queue (<code>DEAD</code>) for manual inspection and replay.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: JOB LIFECYCLE & STATUS MACHINE */}
        <section className="panel support-panel">
          <div className="support-section-header">
            <Clock3 size={20} className="section-icon" />
            <div>
              <h2>Job States &amp; Lifecycle Transitions</h2>
              <p>Understand the transition stages of background tasks as they move across the cluster</p>
            </div>
          </div>

          <div className="lifecycle-cards">
            <div className="lifecycle-card">
              <div className="lifecycle-header">
                <span className="state-badge pending">PENDING</span>
                <span className="lifecycle-meta">Initial State</span>
              </div>
              <p>Job is securely written to MongoDB and queued in Redis BullMQ, awaiting an available worker process.</p>
            </div>

            <div className="lifecycle-card">
              <div className="lifecycle-header">
                <span className="state-badge processing">PROCESSING</span>
                <span className="lifecycle-meta">Active Execution</span>
              </div>
              <p>An active worker claimed the job lock and is executing the task (e.g., dispatching email via Brevo API).</p>
            </div>

            <div className="lifecycle-card">
              <div className="lifecycle-header">
                <span className="state-badge completed">COMPLETED</span>
                <span className="lifecycle-meta">Success Terminal</span>
              </div>
              <p>The job finished with successful delivery. Timestamps, execution duration, and delivery response are saved.</p>
            </div>

            <div className="lifecycle-card">
              <div className="lifecycle-header">
                <span className="state-badge retrying">RETRYING</span>
                <span className="lifecycle-meta">Transient Failure</span>
              </div>
              <p>An attempt failed due to a transient network error. BullMQ applies exponential backoff before re-attempting.</p>
            </div>

            <div className="lifecycle-card">
              <div className="lifecycle-header">
                <span className="state-badge dead">DEAD (DLQ)</span>
                <span className="lifecycle-meta">Dead Letter Queue</span>
              </div>
              <p>Retries were exhausted or hit a permanent failure. Stored in DLQ for manual inspection and 1-click re-run.</p>
            </div>

            <div className="lifecycle-card">
              <div className="lifecycle-header">
                <span className="state-badge cancelled">CANCELLED</span>
                <span className="lifecycle-meta">User Aborted</span>
              </div>
              <p>A user cancelled the job while it was in PENDING state before worker execution began.</p>
            </div>
          </div>
        </section>

        {/* SECTION 4: QUICKSTART & CLUSTER OPERATIONS */}
        <section className="panel support-panel">
          <div className="support-section-header">
            <Terminal size={20} className="section-icon" />
            <div>
              <h2>Quickstart &amp; Cluster Operations Guide</h2>
              <p>Essential terminal commands to run, scale, and manage the platform locally or in Docker</p>
            </div>
          </div>

          <div className="setup-commands-list">
            <div className="setup-command-row">
              <div className="setup-command-info">
                <strong>Run Stack with Docker Compose</strong>
                <span>Spins up MongoDB, Redis, Express API, and worker replicas in unified containers</span>
              </div>
              <div className="code-copy-box">
                <code>docker compose up -d</code>
                <button
                  className="icon-button"
                  onClick={() => handleCopy("docker compose up -d", "cmd-docker")}
                  title="Copy command"
                >
                  {copiedKey === "cmd-docker" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="setup-command-row">
              <div className="setup-command-info">
                <strong>Horizontally Scale Worker Replicas</strong>
                <span>Dynamically scale background worker processes to increase concurrency</span>
              </div>
              <div className="code-copy-box">
                <code>docker compose up -d --scale worker=5</code>
                <button
                  className="icon-button"
                  onClick={() =>
                    handleCopy("docker compose up -d --scale worker=5", "cmd-scale")
                  }
                  title="Copy command"
                >
                  {copiedKey === "cmd-scale" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="setup-command-row">
              <div className="setup-command-info">
                <strong>Run Worker Process Locally</strong>
                <span>Start an autonomous worker node directly with Node.js</span>
              </div>
              <div className="code-copy-box">
                <code>npm run worker</code>
                <button
                  className="icon-button"
                  onClick={() => handleCopy("npm run worker", "cmd-worker")}
                  title="Copy command"
                >
                  {copiedKey === "cmd-worker" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="setup-command-row">
              <div className="setup-command-info">
                <strong>Run API Development Server</strong>
                <span>Start Express API gateway with live watch mode on port 5000</span>
              </div>
              <div className="code-copy-box">
                <code>npm run dev</code>
                <button
                  className="icon-button"
                  onClick={() => handleCopy("npm run dev", "cmd-dev")}
                  title="Copy command"
                >
                  {copiedKey === "cmd-dev" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
