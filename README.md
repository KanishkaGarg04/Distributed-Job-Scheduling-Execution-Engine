# Distributed Job Scheduler

A learning project for an asynchronous job API and worker system using Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL, and Prisma.

## Current state

Milestone 4 implements the asynchronous path: the API saves each job to PostgreSQL, enqueues its ID with BullMQ in Redis, and returns `202 Accepted`. A separate worker loads the job, runs one of two bounded demo handlers, and records status, result/error, duration, and execution history. Priority and delayed availability are applied by BullMQ. Retries, cancellation, idempotency keys, recovery reconciliation, Docker Compose, structured logging, and dependency-aware health/queue metrics are later milestones. This is a learning system, not a production-ready service.

## Requirements

- Node.js 22.12 or newer
- npm

## Run locally

```powershell
npm install
```

Start PostgreSQL and Redis locally. Docker Compose is planned for a later milestone. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if your PostgreSQL credentials differ. The example defaults match a PostgreSQL database named `djs_db` with a user named `djs_user`; create that database/user locally or edit the URL. Redis defaults to `127.0.0.1:6379`.

Apply the PostgreSQL schema migration once:

```powershell
npm run db:migrate
```

Open two terminals in this project directory. Start the API in the first with `npm run dev:api`, and a worker in the second with `npm run dev:worker`. Start another worker in a third terminal to demonstrate independent consumers. Each worker defaults to concurrency 5; set `WORKER_CONCURRENCY` in `.env` to change it per process.

Example request from another PowerShell window:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs -ContentType 'application/json' -Body '{"type":"report.generate","payload":{"reportName":"weekly","rows":500}}'
```

Then use the returned ID at `GET http://localhost:3000/api/jobs/{id}`. A data-processing request `{"type":"data.process","payload":{"values":[1,2,3]}}` eventually returns a completed job with `count`, `sum`, and `average`. Priority ranges 1–10, with 10 highest; delay is 0–86400 seconds. Watch the worker terminal for lifecycle messages. `npm test`, `npm run typecheck`, and `npm run build` run the automated checks.

Tests use fake repositories and a fake queue at the boundaries, so they do not require live services. A full API-to-Redis-to-PostgreSQL run requires both services; it has not been verified in this environment because Docker is unavailable and no local database services were found.

## Design overview

See [architecture.md](architecture.md) for the implemented queue/worker flow. The current API behavior is described in [docs/api.md](docs/api.md); implementation decisions and current failure behavior are in [docs/decisions.md](docs/decisions.md) and [docs/failure-scenarios.md](docs/failure-scenarios.md). The learning questions tied to code are in [docs/interview-guide.md](docs/interview-guide.md).
