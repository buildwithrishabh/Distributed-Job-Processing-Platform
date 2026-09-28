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
- [🛠️ Technology Stack](#️-technology-stack)
- [⚡ Getting Started](#-getting-started)
- [🔌 API Endpoints](#-api-endpoints)
- [🖥️ Frontend Overview](#️-frontend-overview)
- [🧠 Deep Dive & Architecture Doc](#-deep-dive--architecture-doc)
- [📄 License](#-license)

---

## ✨ Introduction

The **Distributed Job Processing Platform** is a full-stack application designed to reliably execute **asynchronous, long-running background tasks** at scale. When an API request is received (e.g. sending emails, generating reports, batch processing), the platform:

1. **Persists** the job definition in MongoDB.
2. **Enqueues** the job onto a Redis-backed BullMQ queue.
3. **Distributes** it across multiple background workers.
4. **Recovers** from transient failures via exponential backoff and isolates dead jobs in a Dead Letter Queue (DLQ).

For a complete breakdown of the code structure and files, see [ARCHITECTURE.md](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/ARCHITECTURE.md).

---

## 🚀 Features

| Area | Feature | Description |
|------|---------|-------------|
| **Job Queuing** | BullMQ & Redis | Scalable queue with priorities, delays, and custom attempts |
| **Workers** | Distributed scaling | Scale horizontally by running multiple worker containers/processes |
| **Concurrency** | Distributed Locks | Per-worker concurrency with **Redis distributed locks** to prevent duplicates |
| **DLQ** | Dead Letter Queue | Failed jobs are quarantined and can be manually re-queued |
| **Idempotency** | Idempotency Keys | `Idempotency-Key` header prevents duplicate job creation |
| **Backpressure** | Capacity Guard | Returns `503 Service Unavailable` with `Retry-After` if queue overflows |
| **Worker Health** | Heartbeat System | Workers ping Redis periodically; tracks `HEALTHY` / `STALE` / `DEAD` workers |
| **Auth** | JWT Credentials | Secure access/refresh token rotation using httpOnly cookies |

---

## 🏗️ Architecture Overview

`React Frontend (Dashboard)` ➔ `Express API (Auth, Idempotency, Backpressure)` ➔ `Redis (BullMQ Queue & Locks)` ➔ `Distributed Workers` ➔ `MongoDB (Job State Store)`

A client submits a job via `POST /api/jobs`. The Express API processes it through a middleware pipeline (auth, backpressure, idempotency, validation), saves the state in MongoDB, and enqueues the task in Redis. Scalable BullMQ workers poll Redis, lock jobs to prevent concurrent execution, run the processor, and update the final status.

---

## 🛠️ Technology Stack

*   **Backend**: Node.js 20, Express 5, BullMQ 6, Redis 7 (via `ioredis`), MongoDB 7, Mongoose 9, Zod 4 (schema validation), JWT & Bcryptjs (security), Helmet & Morgan.
*   **Frontend**: React 18, Vite, React Router 7, TanStack Query 5, Axios (with single-flight refresh interception), Lucide React (icons), Custom Layered Vanilla CSS Design System (with light/dark mode and zero framework overhead).

---

## ⚡ Getting Started

### 🐳 Docker Setup (Recommended Quickstart)

The backend includes a `docker-compose.yml` that orchestrates the entire stack (MongoDB, Redis, API, and Workers):

```bash
cd backend

# Build and start the stack in the background
docker compose up --build -d

# Scale workers horizontally (e.g. run 4 worker instances)
docker compose up -d --scale worker=4

# Stop the stack and remove volumes (re-initialize databases)
docker compose down -v
```

### 💻 Local Development Setup

**1. Set Environment Variables**
Copy the backend config template:
```bash
cd backend
cp .env.example .env
```
*(Configure local MongoDB & Redis credentials inside `.env`)*

**2. Install and Start Services**
```bash
# Terminal 1: Install & run API Server
cd backend
npm install
npm run dev

# Terminal 2: Start worker process
cd backend
npm run worker:dev

# Terminal 3: Install & run Frontend Dashboard
cd ../frontend
npm install
npm run dev
```

---

## 🔌 API Endpoints

All endpoints except authentication and health checks require a valid JWT access token (provided via the `Authorization: Bearer <token>` header or `accessToken` httpOnly cookie).

### Auth — `/api/auth`
- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - Authenticate and set credentials in httpOnly cookies
- `POST /api/auth/refresh` - Rotate access/refresh tokens
- `POST /api/auth/logout` - Clear cookies and invalidate session
- `GET  /api/auth/me` - Fetch details of the current logged-in user

### Jobs & DLQ — `/api/jobs`
- `POST /api/jobs` - Enqueue a job (supports `Idempotency-Key` header, scoped to user)
- `GET  /api/jobs` - Paginated job query (filtered by status, scoped to user)
- `GET  /api/jobs/:id` - Fetch job status and details by ID
- `DELETE /api/jobs/:id` - Cancel a `PENDING` job
- `GET  /api/jobs/dead` - Retrieve quarantined `DEAD` jobs (DLQ, scoped to user)
- `POST /api/jobs/:id/retry` - Re-enqueue a failed/dead job back to `PENDING` (protected by Redis lock)

### Monitoring — `/api/monitoring`
- `GET /api/monitoring/overview` - Consolidated system metrics (queue, user job stats, worker cluster)
- `GET /api/monitoring/queue` - BullMQ queue counts (`waiting`, `active`, `delayed`, `failed`, `completed`)
- `GET /api/monitoring/jobs` - Status breakdown for the authenticated user's jobs
- `GET /api/monitoring/workers` - Active worker list with heartbeats and health classification (`HEALTHY`, `STALE`, `DEAD`)

### Health Checks
- `GET /health` - Root API server health status check (`{ status: "OK", timestamp }`)
- `GET :10000/` - Worker process HTTP health check (used for Render deployment / port detection)

---

## 🖥️ Frontend Overview

A monitoring and management web app is provided at `http://localhost:5173`. Key modules include:
- **System Dashboard**: Real-time queue metrics, status distribution, and active worker node summary.
- **Job Management Table**: Status filtering, client-side search, payload inspection in a slide-out drawer, and job cancellation.
- **Dead Letter Queue (DLQ)**: Quarantined jobs table with error stack traces, failure attempts, and 1-click retry.
- **Worker Cluster Inspector**: Live heartbeat cards displaying worker PIDs, memory usage, uptime, and freshness statuses.
- **Interactive Job Submission**: Modal dialog supporting custom JSON payloads, job types, execution priorities, and custom idempotency keys.
- **Settings & Theme**: Configurable query polling lag (5s, 10s, 30s, or off) and full light/dark theme toggle.

---

## 🧠 Deep Dive & Architecture Doc

For in-depth explanations on the core engineering mechanisms, check out the dedicated **[ARCHITECTURE.md](file:///d:/Backend/Backend%20Projects/Distributed%20Job%20Processing%20Platform/ARCHITECTURE.md)** file, which details:
- 🔄 **Job Lifecycle**: Complete state transitions (`PENDING` ➔ `PROCESSING` ➔ `COMPLETED`/`DEAD`).
- 🔒 **Distributed Locking**: Mutex locking implementation details with Lua scripting.
- ⚙️ **Idempotency, Backpressure & Worker Heartbeats**: Internal middleware logic and heartbeats.
- 📜 **Full Environment Variable Reference**: Complete table of configurations.
- 🧪 **Testing Scenarios**: Practical steps to simulate failures, retries, and locks.

---

## 📄 License

This project is for learning and portfolio purposes. No license is currently specified.
