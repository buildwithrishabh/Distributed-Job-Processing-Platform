# 🏗️ System Architecture & Deep Dive

This document provides a detailed breakdown of the **Distributed Job Processing Platform**'s architecture, folder structure, job lifecycle, implementation mechanics, environment variables, and testing scenarios. 

For the high-level summary and getting started instructions, refer to the main [README.md](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/README.md).

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

The system manages the state of each job explicitly. The status definitions (defined in [constant.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/config/constant.js)) are:
*   `PENDING`: Job has been saved to MongoDB and enqueued on Redis/BullMQ.
*   `PROCESSING`: A worker has locked and claimed the job, incremented its attempt count, and is executing its processor.
*   `COMPLETED`: The job completed successfully.
*   `FAILED` / `RETRYING`: The job failed execution but has remaining attempts; it is scheduled to retry with exponential backoff.
*   `CANCELLED`: The job was cancelled by the user prior to processing; when a worker picks it up, it skips execution immediately.
*   `DEAD`: The job exhausted all attempts or threw a permanent error, and is placed in the DLQ.

---

## 🧠 How It Works (Deep Dive)

### Job Submission Flow

1. `POST /api/jobs` hits the job route ([jobRoutes.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/routes/jobRoutes.js)) wrapped in a middleware chain:
   - `authenticate` → verify JWT.
   - `backpressureGuard` → reject with `503` if the queue is over capacity.
   - `idempotencyMiddleware` → look up the `Idempotency-Key` in Redis.
   - `validateCreateJob` → Zod schema validation & sanitization.
2. `jobController.createJob` → `jobService.createJobService`:
   - Generates a unique `jobId` (`job_<timestamp>_<random>`).
   - Persists the job (`status: PENDING`) in **MongoDB**.
   - Optionally caches the `jobId` against the idempotency key in Redis (TTL 24h).
   - Calls `addJobToQueue` to place it on the BullMQ queue with its attempts/priority.

### Worker Processing Flow

The worker ([jobWorker.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/worker/jobWorker.js)) is the heart of the system. For each job:

1. **Acquire a Redis distributed lock** (`worker:job:<jobId>`, 20s TTL). If another worker holds it, this instance **skips** — preventing duplicate execution.
2. **Re-check state in Mongo** — if the job is missing or `CANCELLED`, skip.
3. **Atomically transition to `PROCESSING`** using `findOneAndUpdate` guarded against `CANCELLED`.
4. Run the **registered processor** for the job `type` via the processor **registry/dispatch** ([index.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/processors/index.js)), wrapped in a **15-second timeout** ([timeout.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/utils/timeout.js)).
5. On success, atomically update status → `COMPLETED` with `completedAt`.
6. On failure, the `failed` event sets `RETRYING` (with attempts left) or `DEAD` (attempts exhausted / unrecoverable), capturing error message + stack + `failedAt`.
7. Always **release the lock** in a `finally` block.

### Retry & Backoff Strategy

- Default `attempts: 3` with **exponential backoff** (`delay: 2000` → powers of 2: 2s, 4s, …) — configured in [job.queue.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/queues/job.queue.js).
- A job goes to `DEAD` when:
  - attempts are exhausted, **or**
  - the processor throws an **`UnrecoverableError`** (permanent failure — BullMQ won't even retry these).
- In [email.processor.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/processors/email.processor.js), `UnrecoverableError` is used for **invalid payloads** (missing `to`/`subject`, malformed email) and **Brevo 400** responses, so bad data never burns retry budget.
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

[lock.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/utils/lock.js) implements a **distributed mutex** with:
- `acquireLock`: `SET key token NX EX <ttl>` (returns a unique random token, or `null` if already held).
- `releaseLock`: a **Lua script** that verifies token ownership before deleting — preventing a worker from releasing someone else's lock after a timeout.

Locks are used for unique job execution and safe DLQ retries.

### Idempotency

[idempotency.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/middleware/idempotency.js):
- Reads the `Idempotency-Key` request header.
- Checks Redis (`idempotency:<key>`) for an existing `jobId` — if found, returns the **existing job** (`200`, `isDuplicate: true`) instead of creating a new one.
- Otherwise attaches the key to the request so the service can bind & persist it.
- Keys are stored in Redis with a **24-hour TTL**, while the DB also enforces a **unique `idempotencyKey`** index as a second layer of protection.

### Backpressure Control

[backpressure.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/middleware/backpressure.js):
- Before enqueuing, checks the current queue **waiting count** against `MAX_QUEUE_CAPACITY`.
- If overloaded, returns `503 Service Unavailable` with a `Retry-After: 30` header so producers back off.
- **Fails open** if the metric call errors, so a Redis blip can't take the API down.

### Worker Heartbeat & Health Monitoring

[heartBeat.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/utils/heartBeat.js):
- Every worker writes a heartbeat to Redis (`worker:heartbeat:<workerId>`) with **10s interval, 30s TTL**, including `pid`, `memoryUsage`, `uptime`, `lastSeen`.
- `getActiveWorker()` reads all heartbeats and classifies health:
  - `HEALTHY` (seen < 15s) · `STALE` (15–30s) · `DEAD` (> 30s).
- This powers `/api/monitoring/workers` so the dashboard can render a live **worker cluster view**.

### Distributed vs Concurrent Processing

- **Distributed**: multiple *processes/containers* each run `src/worker.js` and consume from the same queue. BullMQ + Redis guarantees each job is handed to **exactly one** worker.
- **Concurrent**: each worker processes up to `WORKER_CONCURRENCY` (default `5`) jobs in parallel.
- The **Redis lock** adds an extra safety net so a job never runs twice, even across processes.

---

## 🔒 Security Summary

- **Helmet** security headers configured.
- **CORS** restricted to `CLIENT_URL` with `credentials: true`.
- Passwords **bcrypt-hashed** (10 salt rounds); password and refresh token are `select: false` in the schema.
- **JWT access tokens** (15m) + **refresh tokens** (7d) with **rotation** (hashed `sha256` stored in DB) and logout invalidation.
- Tokens delivered via **httpOnly, `sameSite`-aware cookies** (JS can't read them).
- Centralized global **error handler** that avoids leaking stack traces in production.
- Unique + sparse indexes on `idempotencyKey`, unique `jobId`, compound index on `{status, createdAt}` for fast monitoring queries.

---

## 📜 Environment Configuration Reference

All variables are validated by **Zod** at startup ([env.js](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/backend/src/config/env.js)).

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
