<div align="center">

# ⚙️ Distributed Job Processing Platform

**A scalable, production-grade asynchronous job processing system** built with **Node.js, Express, BullMQ, Redis & MongoDB** — featuring distributed workers, dead-letter queues, idempotent job submission, distributed locks, heartbeat-based worker health monitoring and backpressure control.

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000)](https://expressjs.com)
[![BullMQ](https://img.shields.io/badge/BullMQ-6-FF1E1E)](https://docs.bullmq.io)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

</div>

---

## 🧭 Table of Contents

- [✨ Introduction](#-introduction)
- [🚀 Features](#-features)
- [🏗️ Architecture Overview](#️-architecture-overview)
- [📁 Project Structure](#-project-structure)
- [🛠️ Technology Stack](#️-technology-stack)
- [⚡ Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Local Setup (Without Docker)](#local-setup-without-docker)
  - [Docker Setup](#docker-setup)
- [💻 Running & Development](#-running--development)
- [🔌 API Reference](#-api-reference)
  - [Auth Endpoints](#auth-endpoints)
  - [Job Endpoints](#job-endpoints)
  - [Monitoring Endpoints](#monitoring-endpoints)
  - [DLQ Endpoints](#dlq-endpoints)
- [🔄 Job Lifecycle](#-job-lifecycle)
- [🧠 How It Works (Deep Dive)](#-how-it-works-deep-dive)
  - [Job Submission Flow](#job-submission-flow)
  - [Worker Processing Flow](#worker-processing-flow)
  - [Retry & Backoff Strategy](#retry--backoff-strategy)
  - [Dead Letter Queue (DLQ)](#dead-letter-queue-dlq)
  - [Distributed Locking (Redis)](#distributed-locking-redis)
  - [Idempotency](#idempotency)
  - [Backpressure Control](#backpressure-control)
  - [Worker Heartbeat & Health Monitoring](#worker-heartbeat--health-monitoring)
  - [Distributed vs Concurrent Processing](#distributed-vs-concurrent-processing)
- [🔒 Security](#-security)
- [🖥️ Frontend Overview](#️-frontend-overview)
- [📜 Environment Configuration Reference](#-environment-configuration-reference)
- [🧪 Testing Ideas](#-testing-ideas)
- [🛣️ Roadmap](#️-roadmap)
- [📄 License](#-license)

---

## ✨ Introduction

The **Distributed Job Processing Platform** is a full-stack application designed to reliably execute **asynchronous, long-running or heavy background work** at scale. When an API request comes in that should not block the request/response cycle (e.g. sending emails, generating reports, batch processing), the platform:

1. **Persists** the job definition in MongoDB,
2. **Enqueues** it onto a Redis-backed BullMQ queue,
3. **Distributes** it to one or more background worker processes,
4. **Tracks** the full lifecycle — from `PENDING` through to `COMPLETED` or `DEAD`,
5. **Recovers** from failures automatically via retries with exponential backoff and a Dead Letter Queue (DLQ).

While a modern React dashboard ships as a monitoring/management UI, **this README focuses on the backend**, which is where all of the core engineering lives.

---

## 🚀 Features

| Area | Feature |
|------|---------|
| **Job Queuing** | Redis-backed **BullMQ** queue with priorities, delays and configurable attempts |
| **Distributed Workers** | Scale horizontally — spawn unlimited worker processes/containers |
| **Concurrency** | Per-worker concurrency with **Redis distributed locks** to prevent duplicate processing |
| **Exponential Backoff** | Automatic retries with exponential backoff on transient failures |
| **Dead Letter Queue** | Dead jobs are quarantined, listed and **manually re-queuable** via API |
| **Idempotency** | `Idempotency-Key` header prevents duplicate job submission (Redis + Mongo backed) |
| **Backpressure** | Queue capacity guard returns `503` + `Retry-After` when overloaded |
| **Health Monitoring** | Worker **heartbeat** system → reports `HEALTHY` / `STALE` / `DEAD` state |
| **Auth** | JWT access + refresh token auth with **httpOnly cookies** and token rotation |
| **Job Timeouts** | Per-job execution timeout (`15s`) prevents stuck jobs |
| **Unrecoverable Errors** | Permanent failures never consume retry budget (`UnrecoverableError`) |
| **Cancel / Skip Semantics** | Pending jobs can be cancelled; cancelled jobs are skipped by workers |
| **Containerized** | Docker + docker-compose for the full stack (Mongo, Redis, API, Workers) |

---

## 🏗️ Architecture Overview

```
                        ┌──────────────────────────────────────────┐
                        │             React Frontend              │
                        │        (Dashboard / Monitoring)        │
                        └─────────────────┬────────────────────────┘
                                          │ REST (fetch/axios, httpOnly cookies)
                                          ▼
                        ┌──────────────────────────────────────────┐
                        │          Express API  (Node.js)          │
                        │  Auth · Validation · Idempotency ·       │
                        │  Backpressure · Create/List/Cancel Jobs  │
                        └───────┬───────────────┬──────────────────┘
                                │               │
                    Persist      │               │  Enqueue
                    (MongoDB)    ▼               ▼
                        ┌──────────────────────────────────────────┐
                        │        MongoDB  (Job state store)        │
                        └──────────────────────────────────────────┘
                        ┌──────────────────────────────────────────┐
                        │   Redis  ──  BullMQ "job-queue"          │
                        │   · Queue · Lock store · Idempotency ·   │
                        │   · Worker heartbeats                    │
                        └───────┬───────────────┬──────────────────┘
                                │  Consume      │  (shared)
                                ▼               │
        ┌───────────────────────────────────────────────┐
        │          BullMQ Workers (scalable)            │
        │   worker_1 ... worker_N  (N processes)        │
        │   concurrency 5 each · distributed locking    │
        │   → dispatch to registered job processors      │
        └───────────────────────────────────────────────┘
```

### Flow at a Glance

1. **Client** calls `POST /api/jobs` with an authenticated request (+ optional `Idempotency-Key`).
2. **Middleware chain** authenticates → checks **backpressure** → checks **idempotency** → **validates** the payload.
3. **Service** writes a `PENDING` job to **MongoDB** and enqueues it onto Redis/BullMQ.
4. **One worker** (of N) picks the job, acquires a **Redis lock** (preventing duplicates), updates status to `PROCESSING`, runs the matching **processor**, and marks it `COMPLETED` — or `FAILED`/`DEAD` on error.
5. Dead jobs land in the **DLQ** for inspection and manual retry.
6. The **monitoring API** aggregates queue + DB + worker health for the dashboard.

---

## 📁 Project Structure

```
Distributed Job Processing Platform/
├── backend/                              # ← Backend (primary focus)
│   ├── src/
│   │   ├── config/                       # Configuration & connections
│   │   │   ├── constant.js               # Global enums (job status / types)
│   │   │   ├── db.js                     # MongoDB (Mongoose) connection
│   │   │   ├── env.js                    # Zod-validated environment variables
│   │   │   ├── queueConnection.js        # BullMQ Redis connection settings
│   │   │   └── redis.js                  # Shared ioredis client
│   │   ├── controllers/                  # HTTP request handlers
│   │   │   ├── authController.js         # Register / login / refresh / logout
│   │   │   ├── dlqController.js          # Dead-job listing & retry
│   │   │   ├── jobController.js          # Create / list / get / cancel jobs
│   │   │   └── monitoringController.js   # Queue & worker metrics
│   │   ├── middleware/
│   │   │   ├── auth.js                   # JWT authentication guard
│   │   │   ├── backpressure.js           # Queue capacity guard (503)
│   │   │   ├── errorHandler.js           # Global error handler
│   │   │   ├── idempotency.js            # Idempotency-Key middleware
│   │   │   └── validateRequest.js        # Zod schema validation
│   │   ├── models/
│   │   │   ├── job.js                    # Job document (lifecycle state)
│   │   │   └── user.js                   # User document (bcrypt-hashed pwd)
│   │   ├── processors/                   # Job-type execution strategies
│   │   │   ├── index.js                  # Registry → processor dispatch
│   │   │   └── email.processor.js        # Email job (Brevo / simulated)
│   │   ├── queues/
│   │   │   └── job.queue.js              # BullMQ Queue + enqueue helper
│   │   ├── routes/
│   │   │   ├── authRoutes.js             # /api/auth/*
│   │   │   ├── dlqRoutes.js              # /api/jobs/dead, /api/jobs/:id/retry
│   │   │   ├── jobRoutes.js              # /api/jobs
│   │   │   └── monitoringRoutes.js       # /api/monitoring/*
│   │   ├── services/                     # Business logic (separated from routes)
│   │   │   ├── dlqService.js
│   │   │   ├── jobService.js
│   │   │   └── monitoringService.js
│   │   ├── utils/
│   │   │   ├── heartBeat.js              # Worker heartbeat + health evaluation
│   │   │   ├── jwt.js                    # Token generation & hashing helpers
│   │   │   ├── lock.js                   # Redis distributed lock (Lua release)
│   │   │   └── timeout.js                # Promise.race execution timeout wrapper
│   │   ├── worker/
│   │   │   └── jobWorker.js              # BullMQ Worker → processing pipeline
│   │   ├── app.js                        # Express app (middleware + routes)
│   │   ├── server.js                     # HTTP server + graceful shutdown
│   │   └── worker.js                     # Standalone worker process entrypoint
│   │
│   ├── Dockerfile                        # Multi-stage-ish Node 20 production image
│   ├── docker-compose.yml                # Mongo + Redis + API + Worker
│   ├── .env.example                      # Environment template
│   └── package.json
│
└── frontend/                             # React + Vite dashboard (monitoring UI)
    └── src/
        ├── api/client.js                 # Axios client + single-flight token refresh
        ├── components/                   # Dashboard, JobTable, DLQManager, WorkerCluster...
        ├── context/                      # Auth, Settings, UI contexts
        ├── pages/LoginPage.jsx
        └── App.jsx                       # Protected routes
```

---

## 🛠️ Technology Stack

### Backend
| Category | Technology |
|----------|------------|
| Runtime | Node.js 20 |
| Web Framework | Express 5 |
| Job Queue | BullMQ 6 (backed by Redis) |
| In-Memory Data Store / Queue Broker | Redis 7 (via `ioredis`) |
| Database / ODM | MongoDB 7 / Mongoose 9 |
| Validation | Zod 4 (env + request payloads) |
| Authentication | JWT (`jsonwebtoken`) + `bcryptjs` |
| Security | Helmet, CORS, httpOnly cookies |
| HTTP Logging | Morgan |
| Containerization | Docker, docker-compose |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 + Vite | UI framework / build tool |
| React Router 7 | Client-side routing |
| TanStack Query 5 | Server-state & caching |
| Axios | HTTP client with single-flight refresh interception |
| Tailwind (via `ui.jsx`) + Lucide | Styling & icons |

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** 20+
- **MongoDB** 7 (local or Docker)
- **Redis** 7 (local or Docker)
- (Optional) **Docker** & **Docker Compose** for the containerized stack
- (Optional but recommended) **Postman / cURL** for testing the API

### Environment Variables

Copy the template and edit as needed:

```bash
cd backend
cp .env.example .env
```

> **Never commit your real `.env`** — it is ignored via `.gitignore`.

### Local Setup (Without Docker)

**1. Install dependencies**

```bash
cd backend
npm install
```

**2. Start MongoDB & Redis locally** (or run them via docker-compose as infra only):

```bash
docker compose up mongodb redis
```

**3. Start the API server**

```bash
npm run dev          # or: npm start
# [HTTP Server] Running in development mode on port 3000
```

**4. Start one or more worker processes** (each is an independent consumer):

```bash
npm run worker       # or: npm run worker:dev
# [Worker Process] worker_<pid> initialized with concurrency: 5
```

> Open multiple terminals and run `npm run worker` in several of them to see **real distributed processing** with multiple concurrent consumers.

**5. (Optional) Start the dashboard**

```bash
cd ../frontend
npm install
npm run dev          # http://localhost:5173
```

Add a proxy so `/api` and `/health` hit the backend — Vite is configured for `CLIENT_URL=http://localhost:5173`.

### Docker Setup

The `backend/docker-compose.yml` orchestrates the **entire stack** (MongoDB, Redis, API, Worker):

```bash
cd backend

# Build & run the full stack in the background
docker compose up --build -d

# Scale workers horizontally (e.g. 4 worker instances)
docker compose up --build -d --scale worker=4

# Tear everything down
docker compose down

# Tear down + remove volumes (reset DB / queue state)
docker compose down -v
```

The Dockerfile builds a lean `node:20-alpine` production image; the worker container overrides the CMD to run `node src/worker.js`.

---

## 💻 Running & Development

All scripts live in `backend/package.json`:

| Command | Description |
|---------|-------------|
| `npm start` | Run the API server (production) |
| `npm run dev` | Run the API server with auto-reload (`node --watch`) |
| `npm run worker` | Run a single worker process |
| `npm run worker:dev` | Run a worker with auto-reload |

### Quick sanity check

```bash
curl http://localhost:3000/health
# {"status":"OK","timestamp":"..."}
```

---

## 🔌 API Reference

Base URL: `http://localhost:3000/api`

### Common Behaviors

- All protected routes require an **access token** — either an `Authorization: Bearer <token>` header **or** an `accessToken` httpOnly cookie.
- All job & monitoring routes are **authenticated**.
- JSON request/response bodies.

### Auth Endpoints — `/api/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Create account `{name, email, password}` | ❌ |
| `POST` | `/auth/login` | Login → sets httpOnly access/refresh cookies | ❌ |
| `POST` | `/auth/refresh` | Rotate access + refresh tokens from cookie | ❌ |
| `POST` | `/auth/logout` | Invalidate refresh token & clear cookies | ❌ |
| `GET`  | `/auth/me` | Fetch current authenticated user | ✅ |

### Job Endpoints — `/api/jobs`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/jobs` | Create & enqueue a job (with backpressure + idempotency) | ✅ |
| `GET`  | `/api/jobs` | List jobs with `page`, `limit`, `status` filters | ✅ |
| `GET`  | `/api/jobs/:id` | Fetch a single job by its `jobId` | ✅ |
| `DELETE` | `/api/jobs/:id` | Cancel a `PENDING` job | ✅ |

#### Create a Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: <YOUR_UNIQUE_KEY>" \   # optional but recommended
  -d '{
    "type": "email",
    "payload": {
      "to": "user@example.com",
      "subject": "Welcome!",
      "body": "Thanks for joining."
    },
    "priority": 5,
    "maxAttempts": 3
  }'
```

**Response `202 Accepted` (job enqueued):**

```json
{
  "message": "Job accepted and enqueued",
  "job": { "jobId": "job_..._xxxx", "type": "email", "status": "PENDING" }
}
```

> **Idempotency**: submit the same request with the same `Idempotency-Key` again and you'll get a `200` with the **existing** job instead of a duplicate.

### Monitoring Endpoints — `/api/monitoring` (all authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/monitoring/queue` | BullMQ queue counts (waiting/active/delayed/failed/completed) |
| `GET` | `/monitoring/jobs` | MongoDB job counts grouped by status |
| `GET` | `/monitoring/workers` | Live worker health from heartbeats |
| `GET` | `/monitoring/overview` | Everything above in one payload |

### DLQ Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/jobs/dead` | List `DEAD` jobs (paginated, newest failures first) | ✅ |
| `POST` | `/api/jobs/:id/retry` | Re-queue a `DEAD`/`FAILED` job back to `PENDING` | ✅ |

---

## 🔄 Job Lifecycle

```
                    ┌───────────────────────────────────────────────┐
                    │                 CREATED (client)              │
                    └───────────────────┬───────────────────────────┘
                                        │ POST /api/jobs (validate, enqueue)
                                        ▼
                    ┌───────────────────────────────────────────────┐
                    │   PENDING   (persisted in Mongo + enqueued)   │
                    └───────────────────┬───────────────────────────┘
                                        │ Worker picks up (lock acquired)
                                        ▼
                    ┌───────────────────────────────────────────────┐
                    │   PROCESSING  (attempts incremented)          │
                    └───────────┬───────────────────┬───────────────┘
                                │  success          │  failure
                                ▼                   ▼
                    ┌───────────────────┐   ┌─────────────────────────┐
                    │   COMPLETED       │   │   RETRYING / FAILED      │
                    └───────────────────┘   │  (re-attempt w/ backoff)│
                                            └─────────┬───────────────┘
                                            attempts exhausted OR
                                            UnrecoverableError
                                                      ▼
                                            ┌─────────────────────────┐
                                            │   DEAD  → DLQ → retry    │
                                            │      (manual re-queue)   │
                                            └─────────────────────────┘

   Cancel Route: PENDING ──(DELETE /api/jobs/:id)──► CANCELLED
```

**Job statuses** (defined in `src/config/constant.js`):
`PENDING` · `PROCESSING` · `COMPLETED` · `FAILED` · `CANCELLED` · `RETRYING` · `DEAD`

---

## 🧠 How It Works (Deep Dive)

### Job Submission Flow

1. `POST /api/jobs` hits the **job route** (`src/routes/jobRoutes.js`) wrapped in a middleware chain:
   - `authenticate` → verify JWT,
   - `backpressureGuard` → reject with `503` if the queue is over capacity,
   - `idempotencyMiddleware` → look up the `Idempotency-Key` in Redis,
   - `validateCreateJob` → Zod schema validation & sanitization.
2. `jobController.createJob` → `jobService.createJobService`:
   - generates a unique `jobId` (`job_<timestamp>_<random>`),
   - persists the job (`status: PENDING`) in **MongoDB**,
   - optionally caches the `jobId` against the idempotency key in Redis (TTL 24h),
   - calls `addJobToQueue` to place it on the BullMQ queue with its attempts/priority.

### Worker Processing Flow

The worker (`src/worker/jobWorker.js`) is the heart of the system. For each job:

1. **Acquire a Redis distributed lock** (`worker:job:<jobId>`, 20s TTL). If another worker holds it, this instance **skips** — preventing duplicate execution.
2. **Re-check state in Mongo** — if the job is missing or `CANCELLED`, skip.
3. **Atomically transition to `PROCESSING`** using `findOneAndUpdate` guarded against `CANCELLED`.
4. Run the **registered processor** for the job `type` via the processor **registry/dispatch** (`src/processors/index.js`), wrapped in a **15-second timeout** (`src/utils/timeout.js`).
5. On success, atomically update status → `COMPLETED` with `completedAt`.
6. On failure, the `failed` event sets `RETRYING` (with attempts left) or `DEAD` (attempts exhausted / unrecoverable), capturing error message + stack + `failedAt`.
7. Always **release the lock** in a `finally` block.

### Retry & Backoff Strategy

- Default `attempts: 3` with **exponential backoff** (`delay: 2000` → powers of 2: 2s, 4s, …) — configured in `job.queue.js`.
- A job goes to `DEAD` when:
  - attempts are exhausted, **or**
  - the processor throws an **`UnrecoverableError`** (permanent failure — BullMQ won't even retry these).
- In `email.processor.js`, `UnrecoverableError` is used for **invalid payloads** (missing `to`/`subject`, malformed email) and **Brevo 400** responses, so bad data never burns retry budget.
- On completion, BullMQ auto-cleans: completed jobs kept for **1h/max 1000**, failed for **24h/max 5000**.

### Dead Letter Queue (DLQ)

Rather than permanently discarding dead jobs, they're:
- Quarantined with status `DEAD` and their error details.
- Exposed via `GET /api/jobs/dead`.
- **Manually recoverable** via `POST /api/jobs/:id/retry`:
  1. acquires a `dlq:retry:<jobId>` Redis lock (prevents concurrent retries),
  2. resets attempts/error/timestamps → `PENDING`,
  3. removes any stale BullMQ job with the same id,
  4. re-enqueues the job.

### Distributed Locking (Redis)

`src/utils/lock.js` implements a **distributed mutex** with:
- `acquireLock`: `SET key token NX EX <ttl>` (returns a unique random token, or `null` if already held).
- `releaseLock`: a **Lua script** that verifies token ownership before deleting — preventing a worker from releasing someone else's lock after a timeout.

Locks are used for unique job execution and safe DLQ retries.

### Idempotency

`src/middleware/idempotency.js`:
- Reads the `Idempotency-Key` request header.
- Checks Redis (`idempotency:<key>`) for an existing `jobId` — if found, returns the **existing job** (`200`, `isDuplicate: true`) instead of creating a new one.
- Otherwise attaches the key to the request so the service can bind & persist it.
- Keys are stored in Redis with a **24-hour TTL**, while the DB also enforces a **unique `idempotencyKey`** index as a second layer of protection.

### Backpressure Control

`src/middleware/backpressure.js`:
- Before enqueuing, checks the current queue **waiting count** against `MAX_QUEUE_CAPACITY`.
- If overloaded, returns `503 Service Unavailable` with a `Retry-After: 30` header so producers back off.
- **Fails open** if the metric call errors, so a Redis blip can't take the API down.

### Worker Heartbeat & Health Monitoring

`src/utils/heartBeat.js`:
- Every worker writes a heartbeat to Redis (`worker:heartbeat:<workerId>`) with **10s interval, 30s TTL**, including `pid`, `memoryUsage`, `uptime`, `lastSeen`.
- `getActiveWorker()` reads all heartbeats and classifies health:
  - `HEALTHY` (seen < 15s) · `STALE` (15–30s) · `DEAD` (> 30s).
- This powers `/api/monitoring/workers` so the dashboard can render a live **worker cluster view**.

### Distributed vs Concurrent Processing

- **Distributed**: multiple *processes/containers* each run `src/worker.js` and consume from the same queue. BullMQ + Redis guarantees each job is handed to **exactly one** worker.
- **Concurrent**: each worker processes up to `WORKER_CONCURRENCY` (default `5`) jobs in parallel.
- The **Redis lock** adds an extra safety net so a job never runs twice, even across processes.

---

## 🔒 Security

- **Helmet** security headers.
- **CORS** restricted to `CLIENT_URL` with `credentials: true`.
- Passwords **bcrypt-hashed** (10 salt rounds); password and refresh token are `select: false` in the schema.
- **JWT access tokens** (15m) + **refresh tokens** (7d) with **rotation** (hashed `sha256` stored in DB) and logout invalidation.
- Tokens delivered via **httpOnly, `sameSite`-aware cookies** (JS can't read them).
- Centralized global **error handler** that avoids leaking stack traces in production.
- Unique + sparse indexes on `idempotencyKey`, unique `jobId`, compound index on `{status, createdAt}` for fast monitoring queries.

---

## 🖥️ Frontend Overview

A React + Vite dashboard (meant to complement the backend) providing:

- **Login / session restore** with single-flight token refresh in the Axios interceptor (`client.js`).
- **Dashboard** — overview metrics (queue, jobs, workers).
- **JobTable** — paginated, status-filtered job listing + create/cancel.
- **DLQManager** — inspect and retry dead jobs.
- **WorkerCluster** — live worker health cards from heartbeats.

Routes: `/` (dashboard), `/jobs`, `/dlq`, `/workers`, `/login`.

---

## 📜 Environment Configuration Reference

All variables are validated by **Zod** at startup (`src/config/env.js`).

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `MONGO_URI` / `MONGODB_URI` | `mongodb://localhost:27017/job_platform` | MongoDB connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(empty)* | Redis auth password |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin |
| `WORKER_ID` | `worker_1` | Worker identifier (used in heartbeats) |
| `WORKER_CONCURRENCY` | `5` | Jobs processed in parallel per worker |
| `JWT_SECRET` | *(dev default)* | Fallback signing secret (min 10 chars) |
| `ACCESS_TOKEN_SECRET` | *(dev default)* | Access token signing key |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | Access token TTL |
| `REFRESH_TOKEN_SECRET` | *(dev default)* | Refresh token signing key |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Refresh token TTL |
| `MAX_QUEUE_CAPACITY` | `1000` | Backpressure threshold (waiting jobs) |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Reserved for rate limiting |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Reserved for rate limiting window |
| `BREVO_API_KEY` | *(empty)* | Brevo key → live emails; empty → simulated |
| `BREVO_SENDER_EMAIL` | `noreply@example.com` | Email sender address |
| `BREVO_SENDER_NAME` | `Distributed Job Platform` | Email sender name |

> ⚠️ Change all default secrets in production.

---

## 🧪 Testing Ideas

- **Simulate transient failure**: set `payload.to = "fail@example.com"` → worker retries with exponential backoff → eventually `FAILED` then ... set `maxAttempts` low to force `DEAD`.
- **Simulate permanent failure**: send an invalid payload (missing `to`) → immediately `DEAD` (no retries, `UnrecoverableError`).
- **Idempotency**: repeat the same create request with the same `Idempotency-Key` → response returns the same `jobId` with `isDuplicate: true`.
- **Backpressure**: set `MAX_QUEUE_CAPACITY` very low, flood jobs → observe `503` + `Retry-After`.
- **Distributed dedup**: run several workers, submit jobs rapidly → each `jobId` is processed exactly once (observe the lock skip messages).
- **DLQ recovery**: force a dead job, then `POST /api/jobs/:id/retry` → it returns to `PENDING` and completes on retry.
- **Cancel**: cancel a pending job, then let the worker pull it → job is skipped, never duplicated.

---

## 🛣️ Roadmap

- [ ] Rate limiting middleware (env vars are already reserved).
- [ ] Webhook / event notifications on job completion & failure.
- [ ] Additional job processors (e.g. `report`, `webhook`, `file-upload`).
- [ ] Job-level timeout configuration via request payload.
- [ ] WebSocket / SSE for real-time dashboard updates.
- [ ] Automated test suite (Jest / Vitest).

---

## 📄 License

This project is for learning/portfolio purposes. No license is currently specified — reach out before reusing it commercially.
