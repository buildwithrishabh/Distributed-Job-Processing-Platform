# Distributed Job Processing Platform

A production-minded, fault-tolerant **Distributed Job Processing Platform** built with **Node.js, Express.js, MongoDB, Redis, BullMQ, and Docker**. 

This system allows clients to submit heavy or long-running background tasks asynchronously via an API. Jobs are enqueued into Redis, consumed concurrently by scaled worker nodes, and audited persistently in MongoDB with full fault-tolerance features (JWT cookie authentication, retries, rate-limiting, idempotency, dead letter queues, distributed locking, graceful shutdown, and monitoring).

---

## 🏗 Architecture Diagram

```text
  +------------------+
  |    HTTP Client   |
  +--------+---------+
           | 1. POST /api/jobs (Submit job with Auth Cookie & Idempotency-Key)
           v
  +------------------+
  |    API Server    | <------ Persists Job State (PENDING) ------> +------------------+
  | (JWT Auth Guard) |                                            |     MongoDB      |
  +--------+---------+                                            |  (Audit & State) |
           | 2. Push job payload                                  +--------^---------+
           v                                                               |
  +------------------+                                                     | 5. Update Status
  |   Redis Queue    |                                                     |    (PROCESSING,
  |     (BullMQ)     |                                                     |     COMPLETED,
  +--------+---------+                                                     |     FAILED,
           |                                                               |     DEAD)
           +-----------------------+-----------------------+               |
           | 3. Fetch Job          | 3. Fetch Job          | 3. Fetch Job  |
           v                       v                       v               |
  +------------------+    +------------------+    +------------------+     |
  |     Worker 1     |    |     Worker 2     |    |     Worker 3     | ----+
  |  (Job Processor) |    |  (Job Processor) |    |  (Job Processor) |
  +------------------+    +------------------+    +------------------+
```

---

## ✨ Features & Architecture Guides

This project includes a comprehensive 19-part modular learning guide located in the [`docs/`](./docs) directory:

| Guide File | Feature | Description |
| :--- | :--- | :--- |
| [`00-project-overview.md`](./docs/00-project-overview.md) | **Project Overview** | Asynchronous architecture, role of Redis, BullMQ, Workers, and MongoDB. |
| [`01-project-setup.md`](./docs/01-project-setup.md) | **Setup & Authentication** | Zod env validation, Mongoose setup, Redis `ioredis` singleton, JWT Double-Token cookie authentication (`User` model, `jwt` utils, `auth` middleware, `authController`). |
| [`02-job-model.md`](./docs/02-job-model.md) | **Job Model** | Mongoose schema design, status enums (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD`), and indexing. |
| [`03-job-api.md`](./docs/03-job-api.md) | **Job API** | REST API endpoints for submitting, fetching, status checking, and cancelling jobs (Secured via `authenticate`). |
| [`04-queue-bullmq.md`](./docs/04-queue-bullmq.md) | **Queue System** | BullMQ producer initialization, job options, and Redis queue management. |
| [`05-worker-system.md`](./docs/05-worker-system.md) | **Worker System** | BullMQ worker setup, competing consumers, concurrency tuning, and state updates. |
| [`06-job-processors.md`](./docs/06-job-processors.md) | **Job Processors** | Modular Strategy Pattern for email sending, PDF report generation, and image resizing. |
| [`07-retries-backoff.md`](./docs/07-retries-backoff.md) | **Retries & Backoff** | Exponential backoff strategy for handling transient failures. |
| [`08-dead-letter-queue.md`](./docs/08-dead-letter-queue.md) | **Dead Letter Queue (DLQ)** | Quarantining unrecoverable jobs and providing admin manual retry endpoints. |
| [`09-idempotency.md`](./docs/09-idempotency.md) | **Idempotency** | Redis header-based deduplication (`Idempotency-Key`) preventing duplicate executions. |
| [`10-job-timeouts.md`](./docs/10-job-timeouts.md) | **Job Timeouts** | `withTimeout` execution wrapper using `Promise.race` to prevent hanging tasks. |
| [`11-graceful-shutdown.md`](./docs/11-graceful-shutdown.md) | **Graceful Shutdown** | Handling OS signals (`SIGTERM`, `SIGINT`) to drain active jobs safely before exit. |
| [`12-worker-heartbeat.md`](./docs/12-worker-heartbeat.md) | **Worker Heartbeat** | Periodic worker liveness tracking in Redis with automatic TTL expiration. |
| [`13-distributed-lock.md`](./docs/13-distributed-lock.md) | **Distributed Lock** | Custom Redis mutual exclusion lock (`SET NX EX`) with atomic Lua script release logic. |
| [`14-rate-limiting.md`](./docs/14-rate-limiting.md) | **Rate Limiting** | Sliding window rate limiter middleware using Redis Sorted Sets (`ZSET`). |
| [`15-backpressure.md`](./docs/15-backpressure.md) | **Backpressure** | Capacity protection middleware rejecting requests with HTTP 503 during queue overload. |
| [`16-monitoring.md`](./docs/16-monitoring.md) | **Monitoring** | Admin metrics aggregation APIs for queue depth, job counts, and worker health. |
| [`17-docker-deployment.md`](./docs/17-docker-deployment.md) | **Docker Deployment** | Docker Compose orchestrator and horizontal worker auto-scaling (`--scale worker=3`). |
| [`18-project-completion.md`](./docs/18-project-completion.md) | **Final Architecture** | End-to-end visual diagrams, API reference, and project completion checklist. |

---

## 🛠 Tech Stack

- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ORM)
- **Queue & Cache**: Redis (ioredis, BullMQ)
- **Authentication**: JWT (Access & Refresh tokens stored in HTTP-Only Cookies, Refresh token SHA-256 hashed in DB)
- **Validation**: Zod
- **Containerization**: Docker / Docker Compose

---

## 🚀 Quick Start Guide

### Environment Setup

Create `.env` file in `backend/`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/job_platform
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=super_secret_jwt_key_change_in_production
ACCESS_TOKEN_SECRET=super_secret_access_token_key
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=super_secret_refresh_token_key
REFRESH_TOKEN_EXPIRES_IN=7d
MAX_QUEUE_CAPACITY=1000
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_SECONDS=60
```

---

## 📬 API Endpoints

### Authentication Endpoints
| Method | Endpoint | Description | Payload Sample |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | `{"name": "Dev", "email": "dev@example.com", "password": "password123"}` |
| `POST` | `/api/auth/login` | Login user & set HTTP-only cookies | `{"email": "dev@example.com", "password": "password123"}` |
| `POST` | `/api/auth/refresh` | Refresh expired access token | (Requires `refreshToken` cookie) |
| `POST` | `/api/auth/logout` | Revoke refresh token & clear cookies | (Requires `refreshToken` cookie) |

### Job Management Endpoints (Secured via `authenticate` middleware)
| Method | Endpoint | Description | Sample Header / Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/jobs` | Submit new job | `{"type": "email", "payload": {"to": "alice@example.com", "subject": "Welcome"}}` |
| `GET` | `/api/jobs` | List all jobs | `GET /api/jobs?page=1&limit=10&status=PENDING` |
| `GET` | `/api/jobs/:id` | Get job status | `GET /api/jobs/job_1771800000000_a1b2c3d` |
| `DELETE` | `/api/jobs/:id` | Cancel pending job | `DELETE /api/jobs/job_1771800000000_a1b2c3d` |
| `GET` | `/api/jobs/dead` | Get Dead Letter Queue | `GET /api/jobs/dead` |
| `POST` | `/api/jobs/:id/retry` | Retry Dead Job | `POST /api/jobs/job_1771800000000_a1b2c3d/retry` |
| `GET` | `/api/monitoring/overview` | Monitoring metrics | `GET /api/monitoring/overview` |

---

## 📁 Project Folder Structure

```text
backend/
├── docs/                # 19 Modular Technical Feature Guides
├── src/
│   ├── config/          # Zod env schema, Database & Redis connection singletons
│   ├── controllers/     # Auth & Job REST Express route controllers
│   ├── middleware/      # Auth, Rate limiter, Idempotency, Backpressure, Request Validation
│   ├── models/          # User & Job Mongoose Schema definitions
│   ├── processors/      # Modular Strategy Pattern Job Processors (email, report, image)
│   ├── queues/          # BullMQ queue producer setup
│   ├── routes/          # Express route definitions (authRoutes, jobRoutes, dlqRoutes, monitoringRoutes)
│   ├── services/        # Business logic services
│   ├── utils/           # JWT helper, Distributed Lock, Heartbeat, Timeout, Shutdown utilities
│   ├── workers/         # BullMQ Worker process handlers
│   ├── app.js           # Express App configuration
│   ├── server.js        # API Server entry point
│   └── workerProcess.js # Worker Process entry point
├── Dockerfile           # Multi-stage Docker container definition
├── docker-compose.yml   # Multi-service orchestrator (API, Workers, MongoDB, Redis)
└── package.json
```

---

## 📜 License
ISC License — Free to use for educational and commercial purposes.
