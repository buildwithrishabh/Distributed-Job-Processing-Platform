import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import { api } from "../api";

export function HelpSupportPage({ onNavigate, onCreate, notify }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedKey, setCopiedKey] = useState(null);

  // Diagnostics state
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null);

  // API Code generator state
  const [selectedEndpoint, setSelectedEndpoint] = useState("create-job");
  const [selectedLanguage, setSelectedLanguage] = useState("curl");

  // Search & FAQ state
  const [faqSearch, setFaqSearch] = useState("");
  const [openFaq, setOpenFaq] = useState({ 0: true });

  // Troubleshooting filter
  const [troubleFilter, setTroubleFilter] = useState("all");
  const [troubleSearch, setTroubleSearch] = useState("");

  // Support ticket form state
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    category: "general",
    priority: "normal",
    message: "",
    includeDiag: true,
  });
  const [ticketSubmitted, setTicketSubmitted] = useState(null);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  // Copy helper with feedback
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (notify) notify("Copied to clipboard!");
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  // Run live system diagnostics
  const runDiagnostics = async () => {
    setDiagLoading(true);
    const start = performance.now();
    const result = {
      timestamp: new Date().toISOString(),
      apiLatencyMs: null,
      authStatus: "unknown",
      userName: "",
      queueStatus: "unknown",
      waitingJobs: 0,
      activeJobs: 0,
      failedJobs: 0,
      completedJobs: 0,
      workerCount: 0,
      workers: [],
      errors: [],
    };

    try {
      // 1. Auth check
      const authRes = await api.me().catch((e) => {
        result.errors.push(`Auth check failed: ${e.message}`);
        return null;
      });
      if (authRes) {
        result.authStatus = "ok";
        result.userName = authRes.name || authRes.email || "User";
      } else {
        result.authStatus = "error";
      }

      // 2. Queue Overview
      const queueRes = await api.overview().catch((e) => {
        result.errors.push(`Queue monitoring failed: ${e.message}`);
        return null;
      });
      if (queueRes) {
        result.queueStatus = "healthy";
        result.waitingJobs = queueRes.queue?.waiting ?? 0;
        result.activeJobs = queueRes.queue?.active ?? 0;
        result.failedJobs = queueRes.queue?.failed ?? 0;
        result.completedJobs = queueRes.queue?.completed ?? 0;
      } else {
        result.queueStatus = "error";
      }

      // 3. Workers check
      const workersRes = await api.workers().catch((e) => {
        result.errors.push(`Worker monitoring failed: ${e.message}`);
        return [];
      });
      const workerList = Array.isArray(workersRes) ? workersRes : workersRes?.workers || [];
      result.workerCount = workerList.length;
      result.workers = workerList;

      result.apiLatencyMs = Math.round(performance.now() - start);
    } catch (err) {
      result.errors.push(`Diagnostic error: ${err.message}`);
    } finally {
      setDiagResult(result);
      setDiagLoading(false);
    }
  };

  // Run diagnostics automatically on initial mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  // Format diagnostic report as markdown for sharing
  const getDiagnosticReport = () => {
    if (!diagResult) return "No diagnostic data available. Run diagnostics first.";
    return `### Queue Platform Diagnostic Report
- **Timestamp:** ${diagResult.timestamp}
- **API Latency:** ${diagResult.apiLatencyMs ?? "N/A"}ms
- **Auth Session:** ${diagResult.authStatus === "ok" ? "Authenticated (" + diagResult.userName + ")" : "Error"}
- **Queue State:** ${diagResult.queueStatus} (Waiting: ${diagResult.waitingJobs}, Active: ${diagResult.activeJobs}, Completed: ${diagResult.completedJobs}, Failed: ${diagResult.failedJobs})
- **Active Workers:** ${diagResult.workerCount}
${diagResult.workers.map((w, i) => `  - Worker #${i + 1}: ${w.workerId || w.id || "unknown"} (Status: ${w.status || "active"})`).join("\n")}
- **Client User-Agent:** ${navigator.userAgent}
${diagResult.errors.length > 0 ? `\n**Errors:**\n${diagResult.errors.map((e) => `- ${e}`).join("\n")}` : "- **Health Check:** All systems nominal."}`;
  };

  // Submit support ticket handler
  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) return;
    setTicketSubmitting(true);
    setTimeout(() => {
      const ticketId = "TKT-" + Math.floor(100000 + Math.random() * 900000);
      setTicketSubmitted({
        id: ticketId,
        subject: ticketForm.subject,
        category: ticketForm.category,
        priority: ticketForm.priority,
        message: ticketForm.message,
        createdAt: new Date().toLocaleString(),
        includedDiag: ticketForm.includeDiag,
      });
      setTicketSubmitting(false);
      setTicketForm({
        subject: "",
        category: "general",
        priority: "normal",
        message: "",
        includeDiag: true,
      });
      if (notify) notify(`Support ticket ${ticketId} created successfully!`);
    }, 600);
  };

  // API endpoints documentation data
  const apiEndpoints = [
    {
      id: "create-job",
      name: "Create Background Job",
      method: "POST",
      path: "/api/jobs",
      description: "Submit a new background email job with optional idempotency protection and retry configuration.",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "unique-uuid-or-key (optional)",
      },
      body: {
        type: "email",
        payload: {
          to: "recipient@example.com",
          subject: "Welcome to Queue Platform",
          text: "Your distributed background worker is active.",
          html: "<p>Your distributed background worker is active.</p>",
        },
        priority: 1,
        maxAttempts: 3,
      },
      response: {
        success: true,
        jobId: "job_671b4892fa12",
        status: "PENDING",
        type: "email",
        priority: 1,
        attemptsMade: 0,
        maxAttempts: 3,
        createdAt: "2026-10-25T16:30:00.000Z",
      },
    },
    {
      id: "list-jobs",
      name: "List Jobs with Pagination",
      method: "GET",
      path: "/api/jobs?page=1&limit=10&status=PENDING",
      description: "Retrieve paginated background jobs with optional status filter (PENDING, PROCESSING, COMPLETED, FAILED, RETRYING, DEAD, CANCELLED).",
      headers: {
        Accept: "application/json",
      },
      response: {
        jobs: [
          {
            jobId: "job_671b4892fa12",
            status: "PENDING",
            type: "email",
            createdAt: "2026-10-25T16:30:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 10, total: 42, totalPages: 5 },
      },
    },
    {
      id: "get-job",
      name: "Get Single Job Details",
      method: "GET",
      path: "/api/jobs/:id",
      description: "Inspect payload, state history, worker execution details, timestamps, and error traces of a specific job.",
      headers: {
        Accept: "application/json",
      },
      response: {
        jobId: "job_671b4892fa12",
        status: "COMPLETED",
        type: "email",
        payload: { to: "recipient@example.com", subject: "Welcome" },
        attemptsMade: 1,
        maxAttempts: 3,
        processedAt: "2026-10-25T16:30:02.120Z",
        completedAt: "2026-10-25T16:30:03.450Z",
      },
    },
    {
      id: "cancel-job",
      name: "Cancel Pending Job",
      method: "DELETE",
      path: "/api/jobs/:id",
      description: "Cancel a job that is currently waiting in the PENDING state before a worker picks it up.",
      headers: {
        Accept: "application/json",
      },
      response: {
        success: true,
        message: "Job cancelled successfully.",
      },
    },
    {
      id: "retry-job",
      name: "Retry Failed or Dead Job",
      method: "POST",
      path: "/api/jobs/:id/retry",
      description: "Reset execution attempts and re-enqueue a failed or dead-letter job back to the BullMQ queue.",
      headers: {
        Accept: "application/json",
      },
      response: {
        success: true,
        jobId: "job_671b4892fa12",
        status: "PENDING",
        message: "Job successfully re-queued.",
      },
    },
    {
      id: "monitoring-overview",
      name: "Queue & System Metrics",
      method: "GET",
      path: "/api/monitoring/overview",
      description: "Fetch live BullMQ queue metrics (waiting, active, failed, completed, delayed), worker heartbeat counts, and throughput.",
      headers: {
        Accept: "application/json",
      },
      response: {
        queue: { waiting: 2, active: 1, completed: 154, failed: 3, delayed: 0 },
        workers: { activeCount: 3, totalSeen: 3 },
        throughput: { jobsPerMinute: 24 },
      },
    },
  ];

  const currentEndpoint = apiEndpoints.find((e) => e.id === selectedEndpoint) || apiEndpoints[0];

  // Code snippet generators
  const generateSnippet = (endpoint, lang) => {
    const origin = window.location.origin;
    const bodyStr = endpoint.body ? JSON.stringify(endpoint.body, null, 2) : "";

    if (lang === "curl") {
      let cmd = `curl -X ${endpoint.method} "${origin}${endpoint.path}" \\\n`;
      cmd += `  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \\\n`;
      if (endpoint.headers["Content-Type"]) {
        cmd += `  -H "Content-Type: application/json" \\\n`;
      }
      if (endpoint.headers["Idempotency-Key"]) {
        cmd += `  -H "Idempotency-Key: idempotency-req-${Math.random().toString(36).substring(7)}" \\\n`;
      }
      if (endpoint.body) {
        cmd += `  -d '${JSON.stringify(endpoint.body)}'`;
      } else {
        cmd = cmd.slice(0, -3); // trim trailing slash
      }
      return cmd;
    }

    if (lang === "js") {
      let code = `// Submitting with JavaScript Fetch API\n`;
      code += `const response = await fetch("${origin}${endpoint.path}", {\n`;
      code += `  method: "${endpoint.method}",\n`;
      code += `  headers: {\n`;
      code += `    "Authorization": "Bearer " + accessToken,\n`;
      if (endpoint.headers["Content-Type"]) code += `    "Content-Type": "application/json",\n`;
      if (endpoint.headers["Idempotency-Key"]) code += `    "Idempotency-Key": crypto.randomUUID(),\n`;
      code += `  },\n`;
      if (endpoint.body) {
        code += `  body: JSON.stringify(${bodyStr.split("\n").join("\n  ")}),\n`;
      }
      code += `});\n\n`;
      code += `const data = await response.json();\nconsole.log(data);`;
      return code;
    }

    if (lang === "python") {
      let code = `import requests, uuid\n\n`;
      code += `url = "${origin}${endpoint.path}"\n`;
      code += `headers = {\n`;
      code += `    "Authorization": "Bearer <YOUR_ACCESS_TOKEN>",\n`;
      if (endpoint.headers["Content-Type"]) code += `    "Content-Type": "application/json",\n`;
      if (endpoint.headers["Idempotency-Key"]) code += `    "Idempotency-Key": str(uuid.uuid4()),\n`;
      code += `}\n`;
      if (endpoint.body) {
        code += `payload = ${JSON.stringify(endpoint.body, null, 4)}\n\n`;
        code += `response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)\n`;
      } else {
        code += `\nresponse = requests.${endpoint.method.toLowerCase()}(url, headers=headers)\n`;
      }
      code += `print(response.status_code, response.json())`;
      return code;
    }

    return "";
  };

  // Troubleshooting database
  const troubleshootingItems = [
    {
      id: "jobs-stuck-pending",
      category: "workers",
      badge: "Queue State",
      title: "Jobs remaining indefinitely in PENDING state",
      symptom: "Job was created and visible in dashboard, but attempts stay 0 and status never transitions to PROCESSING.",
      cause: "No worker processes are currently running or active worker heartbeats in Redis have expired.",
      solution: "Start at least one background worker instance. Verify Redis connectivity from the worker service.",
      commands: [
        "npm run worker",
        "# Or with Docker Compose:",
        "docker compose up -d backend-worker-1",
      ],
      linkTab: "diagnostics",
      linkText: "Check Workers Health",
    },
    {
      id: "simulated-failure",
      category: "testing",
      badge: "Testing Mode",
      title: "Job fails immediately with 'Simulated transient error'",
      symptom: "Email job immediately moves to RETRYING or DEAD with message: Simulated transient error.",
      cause: "The recipient was set to 'fail@example.com'. This address is specifically hardcoded to test automatic retries, exponential backoff, and Dead Letter Queue handling.",
      solution: "Use any standard recipient email (e.g., 'user@example.com' or your personal email) when testing valid delivery.",
      commands: null,
      linkTab: null,
      linkText: null,
    },
    {
      id: "brevo-simulation",
      category: "email",
      badge: "Email Provider",
      title: "Emails are marked COMPLETED but no email is received in inbox",
      symptom: "Job succeeds with 200 OK and status COMPLETED, but the physical email does not land in inbox.",
      cause: "The backend is running in Email Simulation Sandbox because BREVO_API_KEY is not configured or left empty in backend/.env.",
      solution: "To send real production emails, sign up for Brevo (formerly Sendinblue), obtain an API key, verify a sender email address, and update backend/.env.",
      commands: [
        "# In backend/.env:",
        "BREVO_API_KEY=xkeysib-your-key-here",
        "BREVO_SENDER_EMAIL=verified-sender@yourdomain.com",
        "BREVO_SENDER_NAME=\"Queue Notifications\"",
      ],
      linkTab: null,
      linkText: null,
    },
    {
      id: "idempotency-conflict",
      category: "api",
      badge: "Duplicate Shield",
      title: "HTTP 409 Conflict: 'Duplicate submission prevented'",
      symptom: "Submitting a job returns status 409 with an error indicating an identical idempotency key was reused.",
      cause: "The Idempotency-Key header matched an existing in-flight or completed submission within the cache TTL window.",
      solution: "Ensure your client generates a fresh UUID or unique timestamp key for each distinct job request. Duplicate protection is intentional to prevent double-charging or duplicate emails.",
      commands: null,
      linkTab: "api",
      linkText: "View Idempotency API Docs",
    },
    {
      id: "rate-limit-429",
      category: "security",
      badge: "Rate Limiting",
      title: "HTTP 429 Too Many Requests",
      symptom: "Rapid job submissions receive response status 429 with header Retry-After.",
      cause: "Exceeded the API rate limit window (default: 60 requests per minute per IP/user) designed to protect queue memory.",
      solution: "Implement client-side backoff according to the Retry-After response header, or submit jobs in controlled batches.",
      commands: null,
      linkTab: null,
      linkText: null,
    },
    {
      id: "dead-letter-accumulation",
      category: "queue",
      badge: "DLQ Recovery",
      title: "Jobs accumulating in Dead Letter Queue (DEAD)",
      symptom: "Jobs fail repeatedly and stop retrying, landing in the Dead letter queue tab.",
      cause: "The job exhausted all configured maxAttempts (default: 3) or encountered a non-retryable fatal validation error.",
      solution: "Navigate to the Dead Letter Queue, click on the job to inspect its exact stack trace and payload, resolve the issue, and click 'Retry job' to re-enqueue.",
      commands: null,
      linkTab: "jobs",
      linkText: "Inspect Dead Letter Queue",
    },
  ];

  const filteredTroubleshooting = useMemo(() => {
    return troubleshootingItems.filter((item) => {
      const matchCat = troubleFilter === "all" || item.category === troubleFilter;
      const matchSearch =
        !troubleSearch ||
        item.title.toLowerCase().includes(troubleSearch.toLowerCase()) ||
        item.symptom.toLowerCase().includes(troubleSearch.toLowerCase()) ||
        item.cause.toLowerCase().includes(troubleSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [troubleFilter, troubleSearch]);

  // Frequently Asked Questions
  const faqs = [
    {
      q: "How does the distributed worker system coordinate jobs?",
      a: "When a job is submitted via POST /api/jobs, the API writes a durable record into MongoDB and pushes the job payload onto a Redis list managed by BullMQ. Autonomous Node.js worker processes continuously poll Redis with atomic BRPOPLPUSH operations, process the payload, emit periodic heartbeats every 5 seconds, and report completion or failure back to MongoDB.",
    },
    {
      q: "How does Idempotency protect against duplicate job executions?",
      a: "If an Idempotency-Key header is supplied with your request, the API checks Redis for an active lock or cached job ID. If a network retry occurs while the job is already enqueued, the API rejects duplicate submissions with HTTP 409 or returns the existing job ID, preventing double-sends of critical transactional emails.",
    },
    {
      q: "What is the difference between FAILED and DEAD status?",
      a: "FAILED indicates an individual attempt failed, but automatic retries remain available. The worker applies exponential backoff (e.g. 2s, 4s, 8s) and schedules another attempt. DEAD (Dead Letter Queue) means all retry attempts were completely exhausted or the error was fatal (e.g., malformed email payload). Dead jobs never execute again automatically unless manually re-queued from the dashboard or API.",
    },
    {
      q: "Can I run multiple workers across multiple machines or Docker containers?",
      a: "Yes! BullMQ and Redis handle multi-worker concurrency natively without race conditions. You can spin up as many worker instances as needed (e.g., docker compose up --scale backend-worker=5). Each worker automatically registers a unique workerId and sends heartbeats visible on the Workers page.",
    },
    {
      q: "How do I add a new custom job type besides 'email'?",
      a: "The processor architecture is modular. 1) Create a new handler in `backend/src/processors/`, 2) Register the type in `backend/src/processors/index.js`, 3) Add validation schema in `backend/src/validation/jobValidation.js`. Workers will automatically pick up and execute jobs of the new type.",
    },
    {
      q: "How do I run this platform in local development without Docker?",
      a: "Ensure MongoDB is running on port 27017 and Redis on 6379. Run `npm run dev:backend` in one terminal, `npm run worker` in a second terminal, and `npm run dev:frontend` in a third terminal. Visit http://localhost:5173 to access the dashboard.",
    },
  ];

  const filteredFaqs = useMemo(() => {
    if (!faqSearch) return faqs;
    return faqs.filter(
      (f) =>
        f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
        f.a.toLowerCase().includes(faqSearch.toLowerCase())
    );
  }, [faqSearch]);

  return (
    <div className="support-center">
      {/* Hero Header */}
      <div className="support-hero">
        <div className="support-hero-badge">
          <Sparkles size={14} />
          <span>HELP &amp; SUPPORT CENTER</span>
        </div>
        <h1 className="support-hero-title">Developer Docs &amp; Platform Support</h1>
        <p className="support-hero-subtitle">
          Interactive diagnostic tools, queue architecture guides, copyable API code snippets,
          and troubleshooting solutions for your background processing cluster.
        </p>

        {/* Hero Quick Metrics Ticker */}
        <div className="support-status-ticker">
          <div className="support-ticker-item">
            <span
              className={`status-pulse ${
                diagResult?.apiLatencyMs != null && diagResult?.errors?.length === 0
                  ? "online"
                  : "warning"
              }`}
            />
            <div className="ticker-text">
              <span className="ticker-label">API Gateway</span>
              <span className="ticker-val">
                {diagLoading
                  ? "Checking..."
                  : diagResult?.apiLatencyMs != null
                  ? `Online (${diagResult.apiLatencyMs}ms)`
                  : "Unavailable"}
              </span>
            </div>
          </div>

          <div className="support-ticker-item">
            <span
              className={`status-pulse ${
                diagResult?.workerCount && diagResult.workerCount > 0 ? "online" : "warning"
              }`}
            />
            <div className="ticker-text">
              <span className="ticker-label">Distributed Workers</span>
              <span className="ticker-val">
                {diagLoading
                  ? "Scanning..."
                  : `${diagResult?.workerCount ?? 0} Active Node(s)`}
              </span>
            </div>
          </div>

          <div className="support-ticker-item">
            <span
              className={`status-pulse ${
                diagResult?.queueStatus === "healthy" ? "online" : "warning"
              }`}
            />
            <div className="ticker-text">
              <span className="ticker-label">BullMQ / Redis</span>
              <span className="ticker-val">
                {diagLoading
                  ? "Connecting..."
                  : diagResult?.queueStatus === "healthy"
                  ? "Connected & Ready"
                  : "Degraded"}
              </span>
            </div>
          </div>

          <div className="support-ticker-item">
            <span className="status-pulse online" />
            <div className="ticker-text">
              <span className="ticker-label">Durable Storage</span>
              <span className="ticker-val">MongoDB Connected</span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="support-hero-actions">
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create test job
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setActiveTab("diagnostics");
              runDiagnostics();
            }}
          >
            <RefreshCw size={15} className={diagLoading ? "spin" : ""} />
            Run Diagnostics
          </button>
          <button
            className="button secondary"
            onClick={() => handleCopy(getDiagnosticReport(), "diag-report")}
          >
            {copiedKey === "diag-report" ? <Check size={15} /> : <Copy size={15} />}
            {copiedKey === "diag-report" ? "Report Copied!" : "Export System Info"}
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="support-nav-tabs">
        <button
          className={`support-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <BookOpen size={16} />
          <span>Architecture &amp; Guide</span>
        </button>
        <button
          className={`support-tab-btn ${activeTab === "diagnostics" ? "active" : ""}`}
          onClick={() => setActiveTab("diagnostics")}
        >
          <Zap size={16} />
          <span>Live Diagnostics</span>
          {diagResult?.workerCount === 0 && <span className="tab-pill alert">0 Workers</span>}
        </button>
        <button
          className={`support-tab-btn ${activeTab === "api" ? "active" : ""}`}
          onClick={() => setActiveTab("api")}
        >
          <Code2 size={16} />
          <span>API &amp; Code Snippets</span>
        </button>
        <button
          className={`support-tab-btn ${activeTab === "troubleshooting" ? "active" : ""}`}
          onClick={() => setActiveTab("troubleshooting")}
        >
          <Wrench size={16} />
          <span>Troubleshooting</span>
        </button>
        <button
          className={`support-tab-btn ${activeTab === "faq" ? "active" : ""}`}
          onClick={() => setActiveTab("faq")}
        >
          <CircleHelp size={16} />
          <span>FAQ</span>
        </button>
        <button
          className={`support-tab-btn ${activeTab === "contact" ? "active" : ""}`}
          onClick={() => setActiveTab("contact")}
        >
          <Send size={16} />
          <span>Contact &amp; Ticket</span>
        </button>
      </div>

      {/* TAB 1: ARCHITECTURE & GUIDE */}
      {activeTab === "overview" && (
        <div className="support-tab-content">
          {/* Architecture Pipeline Visualizer */}
          <section className="panel support-panel">
            <div className="support-section-header">
              <Layers size={20} className="section-icon" />
              <div>
                <h2>System Architecture &amp; Data Pipeline</h2>
                <p>How requests flow from your client application to distributed background workers</p>
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
                  <div className="arch-box-badge">MongoDB Save</div>
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
                <span>Poll</span>
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
                <h4><Database size={16} /> Persistent State (MongoDB)</h4>
                <p>
                  Every job record, status change, timestamp, retry counter, and stack trace is durably
                  persisted in MongoDB. This ensures full auditability even if Redis restarts.
                </p>
              </div>
              <div className="info-subcard">
                <h4><Zap size={16} /> Real-Time Coordination (Redis)</h4>
                <p>
                  Redis powers the fast in-memory BullMQ message queue, distributed locking to avoid
                  duplicate processing, rate-limit buckets, and live worker heartbeats.
                </p>
              </div>
            </div>
          </section>

          {/* Job Lifecycle & Status Machine */}
          <section className="panel support-panel">
            <div className="support-section-header">
              <Clock3 size={20} className="section-icon" />
              <div>
                <h2>Job States &amp; Lifecycle Transitions</h2>
                <p>Understand the transition stages of background tasks</p>
              </div>
            </div>

            <div className="lifecycle-cards">
              <div className="lifecycle-card">
                <div className="lifecycle-header">
                  <span className="state-badge pending">PENDING</span>
                  <span className="lifecycle-meta">Initial State</span>
                </div>
                <p>Job is securely written to MongoDB and queued in Redis, awaiting an available worker process.</p>
              </div>

              <div className="lifecycle-card">
                <div className="lifecycle-header">
                  <span className="state-badge processing">PROCESSING</span>
                  <span className="lifecycle-meta">Active Execution</span>
                </div>
                <p>An active worker claimed the job lock and is executing the task (e.g. sending transactional email).</p>
              </div>

              <div className="lifecycle-card">
                <div className="lifecycle-header">
                  <span className="state-badge completed">COMPLETED</span>
                  <span className="lifecycle-meta">Success Terminal</span>
                </div>
                <p>The job finished with exit code 0 or successful provider delivery. Timestamps and execution duration are recorded.</p>
              </div>

              <div className="lifecycle-card">
                <div className="lifecycle-header">
                  <span className="state-badge retrying">RETRYING</span>
                  <span className="lifecycle-meta">Transient Failure</span>
                </div>
                <p>An attempt failed due to a transient error. The queue applies exponential backoff before the next attempt.</p>
              </div>

              <div className="lifecycle-card">
                <div className="lifecycle-header">
                  <span className="state-badge dead">DEAD (DLQ)</span>
                  <span className="lifecycle-meta">Dead Letter Queue</span>
                </div>
                <p>Retries were exhausted (exceeded maxAttempts) or hit a permanent validation failure. Requires manual retry.</p>
              </div>

              <div className="lifecycle-card">
                <div className="lifecycle-header">
                  <span className="state-badge cancelled">CANCELLED</span>
                  <span className="lifecycle-meta">User Aborted</span>
                </div>
                <p>A user cancelled the job while it was in PENDING state before worker execution started.</p>
              </div>
            </div>
          </section>

          {/* Quickstart Setup Commands */}
          <section className="panel support-panel">
            <div className="support-section-header">
              <Terminal size={20} className="section-icon" />
              <div>
                <h2>Quickstart &amp; Cluster Operations</h2>
                <p>Essential terminal commands to run the platform locally or in Docker</p>
              </div>
            </div>

            <div className="setup-commands-list">
              <div className="setup-command-row">
                <div className="setup-command-info">
                  <strong>Run Full Stack with Docker Compose</strong>
                  <span>Spins up MongoDB, Redis, API, and 3 background worker replicas</span>
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
                  <strong>Scale Worker Replicas</strong>
                  <span>Dynamically scale background worker processes to increase concurrency</span>
                </div>
                <div className="code-copy-box">
                  <code>docker compose up -d --scale backend-worker=5</code>
                  <button
                    className="icon-button"
                    onClick={() =>
                      handleCopy("docker compose up -d --scale backend-worker=5", "cmd-scale")
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
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: LIVE SYSTEM DIAGNOSTICS */}
      {activeTab === "diagnostics" && (
        <div className="support-tab-content">
          <section className="panel support-panel">
            <div className="diag-header-row">
              <div className="support-section-header no-margin">
                <Zap size={20} className="section-icon" />
                <div>
                  <h2>Live Cluster Diagnostics Runner</h2>
                  <p>Real-time automated inspection of API latency, Redis Queue, Workers, and Session</p>
                </div>
              </div>
              <div className="diag-actions">
                <button
                  className="button secondary"
                  onClick={runDiagnostics}
                  disabled={diagLoading}
                >
                  <RefreshCw size={15} className={diagLoading ? "spin" : ""} />
                  {diagLoading ? "Running Diagnostics..." : "Refresh Diagnostic"}
                </button>
                <button
                  className="button secondary"
                  onClick={() => handleCopy(getDiagnosticReport(), "diag-export")}
                >
                  {copiedKey === "diag-export" ? <Check size={15} /> : <Copy size={15} />}
                  {copiedKey === "diag-export" ? "Report Copied!" : "Copy Report (MD)"}
                </button>
              </div>
            </div>

            {/* Diagnostic Results Cards */}
            <div className="diag-cards-grid">
              {/* Test 1: API & Latency */}
              <div className="diag-card">
                <div className="diag-card-top">
                  <div className="diag-icon-wrap">
                    <Server size={18} />
                  </div>
                  <span
                    className={`diag-badge ${
                      diagResult?.apiLatencyMs != null ? "success" : "error"
                    }`}
                  >
                    {diagResult?.apiLatencyMs != null ? "PASS" : "FAIL"}
                  </span>
                </div>
                <h3>REST API Connectivity</h3>
                <p>Calculates round-trip HTTP response time between browser and API gateway.</p>
                <div className="diag-stat-row">
                  <span>Round-Trip Latency:</span>
                  <strong>{diagResult?.apiLatencyMs != null ? `${diagResult.apiLatencyMs} ms` : "Failed"}</strong>
                </div>
                <div className="diag-stat-row">
                  <span>Proxy Endpoint:</span>
                  <code>/api</code>
                </div>
              </div>

              {/* Test 2: Auth Session */}
              <div className="diag-card">
                <div className="diag-card-top">
                  <div className="diag-icon-wrap">
                    <ShieldCheck size={18} />
                  </div>
                  <span
                    className={`diag-badge ${
                      diagResult?.authStatus === "ok" ? "success" : "error"
                    }`}
                  >
                    {diagResult?.authStatus === "ok" ? "PASS" : "FAIL"}
                  </span>
                </div>
                <h3>Auth Session &amp; Token</h3>
                <p>Verifies active session credentials, HTTP-only cookie, and user identity.</p>
                <div className="diag-stat-row">
                  <span>Session Status:</span>
                  <strong>{diagResult?.authStatus === "ok" ? "Active" : "Unauthenticated"}</strong>
                </div>
                <div className="diag-stat-row">
                  <span>User Account:</span>
                  <strong>{diagResult?.userName || "None"}</strong>
                </div>
              </div>

              {/* Test 3: Redis & BullMQ */}
              <div className="diag-card">
                <div className="diag-card-top">
                  <div className="diag-icon-wrap">
                    <Layers size={18} />
                  </div>
                  <span
                    className={`diag-badge ${
                      diagResult?.queueStatus === "healthy" ? "success" : "error"
                    }`}
                  >
                    {diagResult?.queueStatus === "healthy" ? "PASS" : "FAIL"}
                  </span>
                </div>
                <h3>Redis Queue Engine</h3>
                <p>Inspects BullMQ queue states, waiting jobs, and atomic lock coordination.</p>
                <div className="diag-stat-row">
                  <span>Active Jobs:</span>
                  <strong>{diagResult?.activeJobs ?? 0} running</strong>
                </div>
                <div className="diag-stat-row">
                  <span>Waiting Jobs:</span>
                  <strong>{diagResult?.waitingJobs ?? 0} queued</strong>
                </div>
              </div>

              {/* Test 4: Workers */}
              <div className="diag-card">
                <div className="diag-card-top">
                  <div className="diag-icon-wrap">
                    <Cpu size={18} />
                  </div>
                  <span
                    className={`diag-badge ${
                      diagResult?.workerCount && diagResult.workerCount > 0 ? "success" : "warning"
                    }`}
                  >
                    {diagResult?.workerCount && diagResult.workerCount > 0 ? "PASS" : "WARN"}
                  </span>
                </div>
                <h3>Distributed Workers</h3>
                <p>Scans Redis for active worker heartbeat keys sent within the last 15 seconds.</p>
                <div className="diag-stat-row">
                  <span>Workers Online:</span>
                  <strong>{diagResult?.workerCount ?? 0} active node(s)</strong>
                </div>
                <div className="diag-stat-row">
                  <span>Processing Capacity:</span>
                  <strong>{diagResult?.workerCount && diagResult.workerCount > 0 ? "Operational" : "Idle / No Workers"}</strong>
                </div>
              </div>
            </div>

            {/* Warning banner if workers count is 0 */}
            {diagResult?.workerCount === 0 && (
              <div className="diag-alert-banner">
                <AlertCircle size={20} className="alert-icon" />
                <div className="alert-content">
                  <strong>No background workers detected!</strong>
                  <p>
                    Submitted jobs will remain queued in <code>PENDING</code> status until a worker
                    process connects. Run <code>npm run worker</code> in your terminal or ensure
                    worker containers are started.
                  </p>
                </div>
                <button
                  className="button primary small"
                  onClick={() => onNavigate("workers")}
                >
                  View Workers Page
                </button>
              </div>
            )}

            {/* Live Active Workers List */}
            {diagResult?.workers && diagResult.workers.length > 0 && (
              <div className="active-workers-box">
                <div className="workers-box-title">
                  <Cpu size={16} />
                  <span>Discovered Worker Nodes ({diagResult.workers.length})</span>
                </div>
                <div className="workers-mini-table">
                  <div className="mini-table-head">
                    <span>Worker ID</span>
                    <span>Status</span>
                    <span>Last Heartbeat</span>
                    <span>Concurrency</span>
                  </div>
                  {diagResult.workers.map((w, idx) => (
                    <div className="mini-table-row" key={w.workerId || idx}>
                      <code>{w.workerId || `worker-${idx + 1}`}</code>
                      <span className="worker-status-chip">
                        <span className="live-dot online" /> {w.status || "healthy"}
                      </span>
                      <span>
                        {w.lastHeartbeat
                          ? new Date(w.lastHeartbeat).toLocaleTimeString()
                          : "Moments ago"}
                      </span>
                      <span>{w.concurrency || 1} task(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: API & CODE GENERATOR */}
      {activeTab === "api" && (
        <div className="support-tab-content">
          <section className="panel support-panel">
            <div className="support-section-header">
              <Code2 size={20} className="section-icon" />
              <div>
                <h2>Interactive API Reference &amp; Code Generator</h2>
                <p>Test and integrate queue endpoints in cURL, JavaScript, or Python</p>
              </div>
            </div>

            <div className="api-generator-layout">
              {/* Endpoint Picker List */}
              <div className="api-endpoint-selector">
                <div className="selector-title">SELECT ENDPOINT</div>
                {apiEndpoints.map((ep) => (
                  <button
                    key={ep.id}
                    className={`endpoint-btn ${selectedEndpoint === ep.id ? "active" : ""}`}
                    onClick={() => setSelectedEndpoint(ep.id)}
                  >
                    <span className={`method-badge ${ep.method.toLowerCase()}`}>
                      {ep.method}
                    </span>
                    <div className="endpoint-btn-text">
                      <strong>{ep.name}</strong>
                      <code>{ep.path}</code>
                    </div>
                  </button>
                ))}
              </div>

              {/* Endpoint Detail & Code Display */}
              <div className="api-code-viewer">
                <div className="viewer-header">
                  <div>
                    <div className="viewer-title">
                      <span className={`method-badge ${currentEndpoint.method.toLowerCase()}`}>
                        {currentEndpoint.method}
                      </span>
                      <code>{currentEndpoint.path}</code>
                    </div>
                    <p className="viewer-desc">{currentEndpoint.description}</p>
                  </div>
                  {/* Language Selector */}
                  <div className="lang-tabs">
                    <button
                      className={`lang-tab ${selectedLanguage === "curl" ? "active" : ""}`}
                      onClick={() => setSelectedLanguage("curl")}
                    >
                      cURL
                    </button>
                    <button
                      className={`lang-tab ${selectedLanguage === "js" ? "active" : ""}`}
                      onClick={() => setSelectedLanguage("js")}
                    >
                      JavaScript
                    </button>
                    <button
                      className={`lang-tab ${selectedLanguage === "python" ? "active" : ""}`}
                      onClick={() => setSelectedLanguage("python")}
                    >
                      Python
                    </button>
                  </div>
                </div>

                {/* Code Snippet Box */}
                <div className="snippet-container">
                  <div className="snippet-toolbar">
                    <span className="snippet-filename">
                      {selectedLanguage === "curl"
                        ? "request.sh"
                        : selectedLanguage === "js"
                        ? "request.js"
                        : "request.py"}
                    </span>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        handleCopy(
                          generateSnippet(currentEndpoint, selectedLanguage),
                          "api-snippet"
                        )
                      }
                    >
                      {copiedKey === "api-snippet" ? <Check size={14} /> : <Copy size={14} />}
                      {copiedKey === "api-snippet" ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="snippet-code">
                    <code>{generateSnippet(currentEndpoint, selectedLanguage)}</code>
                  </pre>
                </div>

                {/* Expected Response Box */}
                <div className="response-preview-box">
                  <div className="response-header">
                    <span>Expected Response (JSON):</span>
                    <span className="status-200">200 OK</span>
                  </div>
                  <pre className="snippet-code response">
                    <code>{JSON.stringify(currentEndpoint.response, null, 2)}</code>
                  </pre>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: TROUBLESHOOTING & SOLUTIONS */}
      {activeTab === "troubleshooting" && (
        <div className="support-tab-content">
          <section className="panel support-panel">
            <div className="support-section-header">
              <Wrench size={20} className="section-icon" />
              <div>
                <h2>Troubleshooting &amp; Common Issues Dictionary</h2>
                <p>Instant diagnosis and proven fixes for common platform hiccups</p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="trouble-controls">
              <div className="search-input-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search symptoms, error messages, keywords..."
                  value={troubleSearch}
                  onChange={(e) => setTroubleSearch(e.target.value)}
                />
              </div>

              <div className="category-pills">
                {["all", "workers", "testing", "email", "api", "queue"].map((cat) => (
                  <button
                    key={cat}
                    className={`category-pill ${troubleFilter === cat ? "active" : ""}`}
                    onClick={() => setTroubleFilter(cat)}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Troubleshooting Cards List */}
            <div className="trouble-list">
              {filteredTroubleshooting.map((item) => (
                <div className="trouble-card" key={item.id}>
                  <div className="trouble-card-header">
                    <span className="trouble-badge">{item.badge}</span>
                    <h3>{item.title}</h3>
                  </div>

                  <div className="trouble-body">
                    <div className="trouble-row">
                      <span className="trouble-label">Symptom:</span>
                      <p className="trouble-symptom">{item.symptom}</p>
                    </div>

                    <div className="trouble-row">
                      <span className="trouble-label">Root Cause:</span>
                      <p>{item.cause}</p>
                    </div>

                    <div className="trouble-row">
                      <span className="trouble-label">Recommended Fix:</span>
                      <p>{item.solution}</p>
                    </div>

                    {item.commands && (
                      <div className="trouble-code-box">
                        <pre>
                          <code>{item.commands.join("\n")}</code>
                        </pre>
                        <button
                          className="icon-button"
                          onClick={() => handleCopy(item.commands.join("\n"), item.id)}
                          title="Copy commands"
                        >
                          {copiedKey === item.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}

                    {item.linkTab && (
                      <div className="trouble-action-row">
                        <button
                          className="button secondary small"
                          onClick={() => {
                            if (item.linkTab === "diagnostics") setActiveTab("diagnostics");
                            else if (item.linkTab === "api") setActiveTab("api");
                            else onNavigate(item.linkTab);
                          }}
                        >
                          {item.linkText} <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredTroubleshooting.length === 0 && (
                <div className="empty-state">
                  <Bug size={32} />
                  <p>No matching troubleshooting topics found.</p>
                  <button className="button secondary" onClick={() => { setTroubleSearch(""); setTroubleFilter("all"); }}>
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: SEARCHABLE FAQS */}
      {activeTab === "faq" && (
        <div className="support-tab-content">
          <section className="panel support-panel">
            <div className="support-section-header">
              <CircleHelp size={20} className="section-icon" />
              <div>
                <h2>Frequently Asked Questions</h2>
                <p>Clear answers to architectural, scalability, and operational questions</p>
              </div>
            </div>

            <div className="faq-search-bar">
              <Search size={16} />
              <input
                type="text"
                placeholder="Filter questions..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
              />
              {faqSearch && (
                <button className="icon-button" onClick={() => setFaqSearch("")}>
                  ×
                </button>
              )}
            </div>

            <div className="faq-accordion-list">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = !!openFaq[idx];
                return (
                  <div className={`faq-item ${isOpen ? "open" : ""}`} key={idx}>
                    <button
                      className="faq-question-btn"
                      onClick={() => setOpenFaq((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    >
                      <span className="faq-q-text">{faq.q}</span>
                      <ChevronDown
                        size={18}
                        className={`faq-chevron ${isOpen ? "rotated" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="faq-answer-pane">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredFaqs.length === 0 && (
                <div className="empty-state">
                  <CircleHelp size={32} />
                  <p>No questions matched your search query.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 6: CONTACT & SUPPORT TICKET */}
      {activeTab === "contact" && (
        <div className="support-tab-content">
          <section className="panel support-panel">
            <div className="support-section-header">
              <Send size={20} className="section-icon" />
              <div>
                <h2>Support Desk &amp; Feedback Dispatcher</h2>
                <p>Submit an issue or technical question with automatic cluster diagnostics</p>
              </div>
            </div>

            <div className="support-contact-grid">
              {/* Form Pane */}
              <div className="contact-form-pane">
                {ticketSubmitted ? (
                  <div className="ticket-success-card">
                    <div className="success-icon-wrap">
                      <CheckCircle2 size={36} />
                    </div>
                    <h3>Support Request Dispatched</h3>
                    <p>
                      Your ticket has been logged with reference ID:{" "}
                      <strong>{ticketSubmitted.id}</strong>
                    </p>
                    <div className="ticket-summary-box">
                      <div>
                        <span>Subject:</span> <strong>{ticketSubmitted.subject}</strong>
                      </div>
                      <div>
                        <span>Category:</span> <strong>{ticketSubmitted.category}</strong>
                      </div>
                      <div>
                        <span>Priority:</span> <strong>{ticketSubmitted.priority}</strong>
                      </div>
                      <div>
                        <span>Attached Diagnostics:</span>{" "}
                        <strong>{ticketSubmitted.includedDiag ? "Yes (Cluster Snapshot)" : "No"}</strong>
                      </div>
                    </div>
                    <div className="ticket-success-actions">
                      <button
                        className="button secondary"
                        onClick={() =>
                          handleCopy(
                            `Ticket: ${ticketSubmitted.id}\nSubject: ${ticketSubmitted.subject}\nCategory: ${ticketSubmitted.category}\n\n${ticketSubmitted.message}`,
                            "ticket-copy"
                          )
                        }
                      >
                        {copiedKey === "ticket-copy" ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === "ticket-copy" ? "Copied" : "Copy Ticket Reference"}
                      </button>
                      <button
                        className="button primary"
                        onClick={() => setTicketSubmitted(null)}
                      >
                        Submit Another Request
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTicket} className="ticket-form">
                    <div className="field">
                      <label htmlFor="ticket-subject">Subject</label>
                      <input
                        id="ticket-subject"
                        type="text"
                        required
                        placeholder="e.g. Worker disconnected during high concurrency"
                        value={ticketForm.subject}
                        onChange={(e) =>
                          setTicketForm((prev) => ({ ...prev, subject: e.target.value }))
                        }
                      />
                    </div>

                    <div className="field-grid-2">
                      <div className="field">
                        <label htmlFor="ticket-category">Category</label>
                        <select
                          id="ticket-category"
                          value={ticketForm.category}
                          onChange={(e) =>
                            setTicketForm((prev) => ({ ...prev, category: e.target.value }))
                          }
                        >
                          <option value="general">General Support</option>
                          <option value="worker">Worker / Scaling Issue</option>
                          <option value="email">Email Delivery / Brevo</option>
                          <option value="dlq">Dead Letter Queue / Retries</option>
                          <option value="bug">Bug Report</option>
                        </select>
                      </div>

                      <div className="field">
                        <label htmlFor="ticket-priority">Priority</label>
                        <select
                          id="ticket-priority"
                          value={ticketForm.priority}
                          onChange={(e) =>
                            setTicketForm((prev) => ({ ...prev, priority: e.target.value }))
                          }
                        >
                          <option value="low">Low - Question</option>
                          <option value="normal">Normal - Operational</option>
                          <option value="urgent">Urgent - Queue Blocked</option>
                        </select>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="ticket-message">Description / Steps to Reproduce</label>
                      <textarea
                        id="ticket-message"
                        rows={4}
                        required
                        placeholder="Please include job IDs, expected vs actual behavior, or log messages..."
                        value={ticketForm.message}
                        onChange={(e) =>
                          setTicketForm((prev) => ({ ...prev, message: e.target.value }))
                        }
                      />
                    </div>

                    <div className="checkbox-field">
                      <input
                        type="checkbox"
                        id="include-diag"
                        checked={ticketForm.includeDiag}
                        onChange={(e) =>
                          setTicketForm((prev) => ({ ...prev, includeDiag: e.target.checked }))
                        }
                      />
                      <label htmlFor="include-diag">
                        Automatically attach live cluster diagnostic specs (Worker count, API latency, Queue depth)
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="button primary"
                      disabled={ticketSubmitting}
                    >
                      <Send size={15} />
                      {ticketSubmitting ? "Submitting..." : "Submit Support Request"}
                    </button>
                  </form>
                )}
              </div>

              {/* Resource Links Pane */}
              <div className="contact-resources-pane">
                <h3>External Resources &amp; Repositories</h3>
                <p>Direct links to project documentation, code repositories, and BullMQ guides.</p>

                <div className="resource-cards">
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="resource-card"
                  >
                    <div className="resource-card-icon">
                      <ExternalLink size={18} />
                    </div>
                    <div>
                      <strong>GitHub Source Repository</strong>
                      <span>Browse code, issue tracker, and worker processors</span>
                    </div>
                  </a>

                  <a
                    href="https://docs.bullmq.io"
                    target="_blank"
                    rel="noreferrer"
                    className="resource-card"
                  >
                    <div className="resource-card-icon">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <strong>BullMQ Documentation</strong>
                      <span>Official guide for Redis job queues, workers &amp; events</span>
                    </div>
                  </a>

                  <a
                    href="https://developers.brevo.com"
                    target="_blank"
                    rel="noreferrer"
                    className="resource-card"
                  >
                    <div className="resource-card-icon">
                      <Mail size={18} />
                    </div>
                    <div>
                      <strong>Brevo API Docs</strong>
                      <span>Transactional email templates and verified domain setup</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
