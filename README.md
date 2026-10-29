# Distributed Job Processing Platform

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-6.x-E0234E?style=flat&logo=redis&logoColor=white)](https://docs.bullmq.io/)
[![Redis](https://img.shields.io/badge/Redis-Upstash%20TLS-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Prometheus](https://img.shields.io/badge/Prometheus-v2.x-E6522C?style=flat&logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-v10-F46800?style=flat&logo=grafana&logoColor=white)](https://grafana.com/)
[![Pino](https://img.shields.io/badge/Pino-Structured%20Logging-68A063?style=flat&logo=pino&logoColor=white)](https://getpino.io/)
[![Tests](https://img.shields.io/badge/Tests-137%2F137%20Passed-brightgreen?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com/)

An enterprise-grade, high-throughput distributed background job processing platform. Built with **Node.js (Express 5)**, **Redis (BullMQ)**, **MongoDB**, and a modern **React SPA dashboard**, fully instrumented with **Prometheus**, **Grafana**, **Pino structured logging**, and a **137-test Vitest test suite**.

Designed to decouple heavy, asynchronous workloads (e.g., transactional emails, batch processing, notifications) from web servers, preventing HTTP request blocking while ensuring at-least-once delivery, fault tolerance, and horizontal scalability.

> 📖 **DevOps & Engineering Deep-Dive**: For complete documentation on Prometheus metrics, auto-provisioned Grafana dashboards, Pino request tracing, test suites, and incident runbooks, please read the [**DEVOPS.md**](DEVOPS.md) guide.

---

## 🌐 Live Production Deployment

- **Web Dashboard**: [distributed-job-processing-platform.vercel.app](https://distributed-job-processing-platform.vercel.app)
- **Frontend Hosting**: Vercel
- **Backend API & Workers**: Render
- **Message Broker & Cache**: Upstash Redis (TLS)
- **Database**: MongoDB Atlas

---

## 🏛 System Architecture

The platform follows a decoupled, producer-consumer distributed architecture with built-in telemetry:

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client & Presentation Layer"]
        UI["React SPA Dashboard (Vercel)"]
        ExternalAPI["External API Clients"]
    end

    subgraph APILayer ["2. API Gateway & Ingestion Layer"]
        API["Express 5 REST API Gateway (Port 5000)"]
        Auth["JWT & Cookie Authentication"]
        RateLimiter["Sliding-Window Rate Limiter"]
        PinoHTTP["pino-http Request Tracing (x-request-id)"]
        MetricsRoute["GET /metrics (prom-client exporter)"]
        Sweeper["Orphan Job Recovery Sweeper"]
    end

    subgraph StorageLayer ["3. State & Queue Coordination"]
        Mongo[("MongoDB Atlas (Durable State)")]
        Redis[("Upstash Redis (BullMQ Broker)")]
    end

    subgraph WorkerLayer ["4. Distributed Worker Execution Layer"]
        Worker1["Worker Node 1 (Concurrency: 5)"]
        Worker2["Worker Node 2 (Concurrency: 5)"]
        WorkerN["Worker Node N (Horizontally Scaled)"]
    end

    subgraph ObservabilityStack ["5. DevOps & Observability Stack"]
        Prometheus["Prometheus (Port 9090)<br/>Scrapes /metrics every 5s"]
        Grafana["Grafana (Port 3001)<br/>Auto-provisioned Dashboards"]
    end

    subgraph ExternalServices ["6. Third-Party Integrations"]
        Brevo["Brevo Email API / Simulation"]
    end

    UI -->|"HTTPS / JSON"| API
    ExternalAPI -->|"HTTPS / JSON"| API

    API --> Auth
    API --> RateLimiter
    API --> PinoHTTP
    API -->|"1. Persist Job (PENDING)"| Mongo
    API -->|"2. Enqueue Job (BullMQ)"| Redis
    Sweeper -.->|"Audit stuck PENDING jobs"| Mongo
    Sweeper -.->|"Re-enqueue orphan jobs"| Redis

    Redis -->|"Consume Task"| Worker1
    Redis -->|"Consume Task"| Worker2
    Redis -->|"Consume Task"| WorkerN

    Worker1 -->|"Distributed Lock & Heartbeat"| Redis
    Worker1 -->|"Update State"| Mongo
    Worker1 -->|"Dispatch Transactional Email"| Brevo

    Worker2 -->|"Distributed Lock & Heartbeat"| Redis
    Worker2 -->|"Update State"| Mongo
    Worker2 -->|"Dispatch Transactional Email"| Brevo

    Prometheus -->|"Pull Scrape (/metrics)"| MetricsRoute
    Grafana -->|"Query Metrics"| Prometheus
    API -->|"Non-blocking SCAN for Heartbeats"| Redis
    API -->|"Aggregated Job Metrics"| Mongo
```

---

## 🔄 End-to-End Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING : Client POST /api/jobs
    PENDING --> CANCELLED : User Cancels Job (if not started)
    PENDING --> PROCESSING : Worker Claims Job & Acquires Redis Lock
    
    PROCESSING --> COMPLETED : Task Finishes Successfully
    PROCESSING --> RETRYING : Transient Error (Exponential Backoff)
    
    RETRYING --> PROCESSING : Next Attempt Scheduled by BullMQ
    RETRYING --> DEAD : Attempts Exhausted (maxAttempts exceeded)
    
    PROCESSING --> DEAD : Permanent / Fatal Error (Unrecoverable)
    
    DEAD --> PENDING : Manual 1-Click Replay / Retry
    COMPLETED --> [*]
    CANCELLED --> [*]
    DEAD --> [*]
```

1. **Submission & Backpressure**: The user submits a job via `POST /api/jobs`. The API validates request schemas via **Zod**, applies Redis sliding-window rate limits, and rejects submissions with `503` if Redis queue depth exceeds capacity.
2. **Durable Ingestion**: The job record is saved to MongoDB as `PENDING`, then pushed to Redis BullMQ priority queue.
3. **Worker Pickup & Distributed Locking**: An autonomous worker process claims the job and acquires an atomic Redis lock (`lock:job:<id>`) to guarantee no duplicate execution across replicas.
4. **Execution & Heartbeat**: The worker sets MongoDB state to `PROCESSING`, runs the registered processor (e.g., Brevo email), and streams progress. Meanwhile, workers broadcast a Redis heartbeat every 10s.
5. **Fault Recovery**:
   - **Transient failures** (e.g., SMTP timeout) automatically trigger **exponential backoff retries** (2s, 4s, 8s...).
   - **Exhausted retries** or unrecoverable inputs move the job to the **Dead Letter Queue (`DEAD`)**.
   - An **Orphan Job Sweeper** runs periodically in the background to detect and re-enqueue jobs that were saved to MongoDB but lost in Redis.

---

## 🚀 Key Engineering Highlights

### 1. Decoupled Web & Worker Topology
- The HTTP API (`backend/src/server.js`) and Background Worker (`backend/src/worker.js`) are distinct processes.
- Heavy workloads (CPU operations, external API latency) run in dedicated worker containers and never block API gateway request threads.
- Workers scale horizontally by simply adding replicas without modifying backend code.

### 2. Monitoring & Observability Stack (Prometheus + Grafana)
- **Pull-based Prometheus exporter**: Native `/metrics` endpoint instrumented via `prom-client`.
- **System & Queue Telemetry**: Live metrics for Node.js event loop lag, memory (Heap Used/Total, RSS), BullMQ backlog states (`waiting`, `active`, `delayed`, `failed`, `completed`), and worker heartbeat counts.
- **Auto-Provisioned Grafana**: Launches ready out-of-the-box on port `3001` with pre-configured datasource and high-impact dashboards (no manual import required).

### 3. High-Performance Structured Logging (Pino)
- **Zero Event-Loop Lag**: Replaced bulky synchronous loggers with asynchronous, non-blocking Pino.
- **Environment Formatting**: Human-friendly colorized logs in development via `pino-pretty`; raw structured JSON in production for log aggregators (Datadog, Loki, CloudWatch).
- **Security & PII Redaction**: Automatic zero-overhead removal of authorization headers, cookies, passwords, and API keys.
- **Request Tracing**: `x-request-id` propagation for end-to-end trace correlation and child loggers attached to each background task.

### 4. Comprehensive Automated Test Suite (100 Tests)
- **137/137 tests passing** across 23 test files powered by **Vitest** and **Supertest**.
- Full coverage for middleware (JWT auth, rate limiting, idempotency, backpressure, validation), service layers, processor retry behaviors, and REST integration endpoints.
- Tests run in fully isolated environments — no live cloud dependencies required.

### 5. Idempotency & Duplicate Prevention
- Endpoints accept an optional `Idempotency-Key` HTTP header.
- Redis caches idempotency keys with short TTLs while MongoDB enforces a compound unique index `(userId, idempotencyKey)` to eliminate duplicate submissions from client retries or network blips.

### 6. Queue Backpressure & Sliding-Window Rate Limiting
- Rejects incoming submissions with `503 Service Unavailable` if Redis queue depth exceeds `MAX_QUEUE_CAPACITY`.
- Protects downstream APIs using atomic Redis sliding-window counter scripts (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_SECONDS`).

---

## 🛠 Technology Stack

| Domain | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | React 18, Vite 5, Lucide Icons | Responsive operational dashboard with real-time cluster metrics |
| **Backend API** | Node.js 20, Express 5 | High-speed RESTful API, authentication, queue routing |
| **Workers** | BullMQ 6, Node.js | Distributed queue processing, exponential backoff, retry scheduling |
| **Message Broker** | Redis (Upstash TLS / ioredis) | In-memory atomic priority queue, locks, worker heartbeats, rate limiting |
| **Durable Storage** | MongoDB Atlas / Mongoose 9 | Source of truth for users, job history, and audit logs |
| **Metrics & Telemetry** | Prometheus, `prom-client` | Time-series metrics collection, queue depth, HTTP latencies, system stats |
| **Visualization** | Grafana 10 | Auto-provisioned dashboards for real-time cluster health and queues |
| **Structured Logging** | Pino, Pino-HTTP | High-throughput structured JSON logging, PII redaction, request tracing |
| **Automated Testing** | Vitest, Supertest | Fast unit and integration test suites (137 passing tests) |
| **Security & Auth** | JWT, bcryptjs, Helmet, CORS | Secure password hashing, HTTP-only cookie tokens, security headers |
| **Email Provider** | Brevo REST API | Transactional email delivery with automatic simulation fallback |
| **Containerization** | Docker, Docker Compose | Multi-container development and production orchestration |

---

## 📊 Monitoring & DevOps Overview

### Prometheus Metrics Summary

The backend exposes metrics on `GET /metrics` formatted for Prometheus:

- **System Metrics**: `job_platform_process_cpu_user_seconds_total`, `job_platform_nodejs_heap_size_used_bytes`, `job_platform_process_resident_memory_bytes`, `job_platform_nodejs_eventloop_lag_seconds`.
- **HTTP Metrics**: `http_request_duration_seconds` (Histogram by route & status), `http_request_total` (Counter).
- **Queue Metrics**: `bullmq_queue_jobs_count` (Gauges for `waiting`, `active`, `delayed`, `failed`, `completed`).
- **Worker & Job Metrics**: `job_platform_active_workers_count`, `job_execution_duration_seconds` (Histogram by job type), `jobs_processed_total` (Counter by status).

### Grafana Pre-Configured Dashboard

Accessible at `http://localhost:3001` (`admin` / `admin`).
Visualizes:
1. **Active Worker Nodes** (real-time heartbeat count with threshold alerts)
2. **Waiting Backlog (Queue)** (warning/critical queue depth indicators)
3. **Active Jobs Processing** & **Failed Jobs in Queue**
4. **Queue Status Breakdown** (stacked time-series for all BullMQ states)
5. **Job Processing Throughput Rate** (`jobs/sec` across statuses)
6. **Execution Duration Latencies** (P95 vs P50 duration percentiles)
7. **HTTP API Request Rate** (broken down by HTTP response status code)
8. **Node.js Process Memory Footprint** (Heap Used vs Heap Total vs RSS in MB)

👉 *For step-by-step metric descriptions, alerting thresholds, and dashboards, refer to [**DEVOPS.md**](DEVOPS.md).*

---

## 🧪 Testing & Quality Assurance

The codebase includes comprehensive unit and integration testing powered by **Vitest**:

```bash
# Run all 137 tests
npm --prefix backend test

# Run tests in watch mode
npm --prefix backend run test:watch
```

### Test Suite Highlights:
- **23 Test Suites, 137 Tests (100% Pass)**
- **Unit Tests (17 files, 92 tests)**:
  - Middlewares: `auth.test.js`, `rateLimiter.test.js`, `idempotency.test.js`, `backpressure.test.js`, `validateRequest.test.js`
  - Socket.IO: `auth.middleware.test.js`, `jobHandler.test.js`, `queueEvents.test.js`, `socketIndex.test.js`
  - Services: `jobService.test.js`, `dlqService.test.js`, `monitoringService.test.js`
  - Processors: `email.processor.test.js` (Simulated network latency, retries, fatal input routing, Brevo API dispatch)
  - Utilities: `jwt.test.js`, `lock.test.js` (Distributed lock concurrency & TTLs), `timeout.test.js`, `metrics.test.js` (Prometheus metric collectors & dynamic gauges)
- **Integration Tests (6 files, 45 tests)**:
  - End-to-end HTTP and WebSocket API tests using Supertest and Socket.IO-Client for Authentication, Job Ingestion & Cancellation, Dead Letter Queue Replay, Cluster Monitoring, Prometheus Metrics Scraping, and Real-Time Socket Events.

---

## 📁 Repository Layout

```text
├── backend/
│   ├── src/
│   │   ├── config/          # Zod env schema, MongoDB, Redis, and BullMQ connections
│   │   ├── controllers/     # Route controllers (Auth, Jobs, Monitoring)
│   │   ├── cron/            # Background orphan job sweeper & recovery
│   │   ├── middleware/      # Auth, rate limiting, validation, httpLogger, error handler
│   │   ├── models/          # Mongoose models (User, Job)
│   │   ├── processors/      # Job dispatcher and email execution worker
│   │   ├── queues/          # BullMQ queue producer definition
│   │   ├── routes/          # REST route declarations (/auth, /jobs, /monitoring, /dlq)
│   │   ├── services/        # Business logic (Job lifecycle, DLQ, Monitoring)
│   │   ├── utils/           # JWT, Redis locks, timeouts, worker heartbeat, logger, metrics
│   │   ├── app.js           # Express app, middleware stack, /metrics endpoint
│   │   ├── server.js        # API HTTP server entry point (Port 5000)
│   │   └── worker.js        # Autonomous background worker entry point (Port 10000)
│   ├── tests/
│   │   ├── unit/            # Unit tests for middlewares, services, utils, processors
│   │   └── integration/     # Full HTTP integration tests (Auth, Jobs, DLQ, Monitoring)
│   ├── vitest.config.mjs    # Vitest runner configuration
│   ├── .env.example         # Backend environment variable template
│   ├── Dockerfile           # Multi-stage production container definition
│   ├── docker-compose.yml   # Multi-service stack: API, 3 Workers, Prometheus, Grafana
│   └── render.yaml          # Render Blueprint for API & Worker Web Services
├── frontend/
│   ├── src/
│   │   ├── components/      # UI Views (Architecture Guide, Workers, Jobs, DLQ)
│   │   ├── api.js           # Fetch API client with automatic token refreshing
│   │   ├── main.jsx         # React application shell & route state
│   │   └── styles.css       # Premium custom styling tokens & layout
│   ├── .env.example         # Frontend environment variable template
│   └── vite.config.js       # Vite configuration with local proxy
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml   # Prometheus scrape configuration (5s interval)
│   └── grafana/
│       ├── dashboards/      # Pre-built Grafana JSON dashboard
│       └── provisioning/    # Auto-provisioned datasources & dashboard providers
├── DEVOPS.md                # Complete DevOps, Observability, Logging & Testing Guide
├── package.json             # Root monorepo scripts for dev, build, and workers
└── README.md                # Project documentation and setup guide
```

---

## 💻 Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas URI)
- [Redis](https://redis.io/) (Local or Upstash TLS URL)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/buildwithrishabh/Distributed-Job-Processing-Platform.git
cd Distributed-Job-Processing-Platform

# Install root, backend, and frontend packages
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Configure Environment Variables

Create `backend/.env` from the example template:

```bash
cp backend/.env.example backend/.env
```

Fill in your database and Redis connection details:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/job_platform
REDIS_HOST=localhost
REDIS_PORT=6379
CLIENT_URL=http://localhost:5173

# Optional: Cloud Redis (e.g. Upstash) overrides REDIS_HOST
# REDIS_URL=rediss://default:token@your-host.upstash.io:6379

WORKER_CONCURRENCY=5
JWT_SECRET=your_jwt_secret_min_10_chars
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret

# Optional: Brevo Email API (Leave blank for simulation mode)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=noreply@example.com
BREVO_SENDER_NAME=Distributed Job Platform
```

### 3. Start Development Services

Run in separate terminal windows from the repository root:

```bash
# Terminal 1: Start Express API Gateway (Port 5000)
npm run dev:backend

# Terminal 2: Start Autonomous Worker Process
npm run worker

# Terminal 3: Start React Dashboard (Port 5173)
npm run dev:frontend
```

Open your browser at `http://localhost:5173` to register an account and test job execution.

---

## 🐳 Docker Compose Deployment (With Prometheus & Grafana)

Run the full containerized stack — Express API, 3 background worker replicas, Prometheus, and Grafana:

```bash
# Build and start all services in the background
npm run docker:up

# Scale worker processes to 5 replicas dynamically
docker compose -f backend/docker-compose.yml up -d --scale worker=5

# View real-time cluster logs
docker compose -f backend/docker-compose.yml logs -f

# Stop the stack
npm run docker:down
```

### Running Services & Ports:
| Service | Container Name | Port | Description |
|---|---|---|---|
| **API Gateway** | `job_platform_api` | `5000` | Express REST API & `/metrics` exporter |
| **Worker Cluster** | `job_platform_worker_1..3` | `10000` | BullMQ background workers (3 replicas, horizontally scalable) |
| **Prometheus** | `job_platform_prometheus` | `9090` | Time-series scraper querying `api:5000/metrics` |
| **Grafana** | `job_platform_grafana` | `3001` | Auto-provisioned dashboards (`admin` / `admin`) |

> **Grafana credentials** are explicitly configured via environment variables (`GF_SECURITY_ADMIN_USER`, `GF_SECURITY_ADMIN_PASSWORD`) with public sign-up disabled (`GF_USERS_ALLOW_SIGN_UP=false`). Both `prometheus` and `grafana` services run with `restart: unless-stopped` for production resilience.

---

## ☁️ Cloud Production Deployment Guide

| Component | Platform | Deployment Instructions |
| --- | --- | --- |
| **Frontend** | **Vercel** | Connect repo, set root directory to `frontend`, output to `dist`, set `VITE_API_URL` to backend URL. |
| **API Gateway** | **Render (Web)** | Runtime: `Docker`. Root directory: `backend`. Default CMD runs `node src/server.js`. |
| **Worker Nodes** | **Render (Web)** | Runtime: `Docker`. Root directory: `backend`. Set **Docker Command override**: `node src/worker.js`, Port: `10000`. |
| **Redis Broker** | **Upstash** | Create free TLS database, paste connection string as `REDIS_URL=rediss://...`. |
| **Database** | **MongoDB Atlas**| Create free M0 cluster, whitelist `0.0.0.0/0`, paste string as `MONGO_URI`. |

> **Why the Worker runs on Port 10000:**
> Render's dedicated "Background Worker" service type is paid-only ($7/month). `backend/src/worker.js` includes a lightweight HTTP health check endpoint on port `10000` (`/`), allowing you to deploy the worker on **Render's Free Web Service tier**. Use a free monitor like [cron-job.org](https://cron-job.org) to ping it every 10 minutes so it stays active.

---

## 📡 REST API Reference

All protected endpoints accept authorization through HTTP-only cookies or `Authorization: Bearer <token>`.

### Authentication Endpoints
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a new user account (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Authenticate user; returns JWT & sets secure cookies |
| `POST` | `/api/auth/refresh` | Rotate access token using secure refresh cookie |
| `POST` | `/api/auth/logout` | Clear user session cookies and refresh token |
| `GET` | `/api/auth/me` | Fetch authenticated profile |

### Job Management Endpoints
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/jobs` | Submit a new job (supports optional `Idempotency-Key` header) |
| `GET` | `/api/jobs` | Query paginated jobs (`?page=1&limit=10&status=PENDING`) |
| `GET` | `/api/jobs/:id` | Fetch specific job details, attempt logs, and duration |
| `DELETE` | `/api/jobs/:id` | Cancel a job while it is in `PENDING` state |
| `GET` | `/api/jobs/dead` | Retrieve all Dead Letter Queue (`DEAD`) jobs |
| `POST` | `/api/jobs/:id/retry` | Re-enqueue a failed or dead job into BullMQ |

### Cluster Telemetry & Monitoring Endpoints
| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/monitoring/overview` | Aggregated cluster summary (queue stats, job totals, worker list) |
| `GET` | `/api/monitoring/queue` | BullMQ active, waiting, delayed, and failed item counts |
| `GET` | `/api/monitoring/workers` | Active worker heartbeats scanned from Redis |
| `GET` | `/metrics` | Prometheus metrics exporter (`prom-client`) |
| `GET` | `/health` | API liveness probe (returns `{ status: "OK", timestamp: "..." }`) |

#### Sample Job Submission Request
```http
POST /api/jobs
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
Idempotency-Key: e82e2cb6-8df7-46e3-a6ea-f8b1e4da2889

{
  "type": "email",
  "payload": {
    "to": "client@example.com",
    "subject": "System Report Ready",
    "text": "Your monthly analytics report has been processed."
  },
  "priority": 2,
  "maxAttempts": 3
}
```

---

## 🧪 Simulation & Failure Testing

To test fault-tolerance, retry backoff, and DLQ behavior without real email charges:
- Sending to `fail@example.com` triggers a simulated transient error. BullMQ will retry with exponential backoff.
- Submitting an invalid email address (e.g. `invalid-email`) triggers an unrecoverable validation error, directly routing the job to `DEAD` without wasteful retries.
- With no `BREVO_API_KEY` provided, jobs run in simulation mode with simulated realistic network delivery latency (800ms - 1.5s).

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
