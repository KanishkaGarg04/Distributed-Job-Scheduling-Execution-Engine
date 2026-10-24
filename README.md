# Distributed Job Scheduler

A learning project for an asynchronous job API and worker system using Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL, and Prisma.

## Current state

Milestone 2 implements a typed Express API, Zod validation, and a temporary in-memory job service. It accepts jobs and supports status lookup and paginated listing. It does **not** enqueue or execute work yet, and submitted jobs disappear when the API process restarts. PostgreSQL persistence is the next milestone.

## Requirements

- Node.js 22.12 or newer
- npm

## Run locally

```powershell
npm install
npm run dev
```

The API listens on port 3000 by default. Copy `.env.example` to `.env` to configure `PORT` or `NODE_ENV`.

Example request from another PowerShell window:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs -ContentType 'application/json' -Body '{"type":"report.generate","payload":{"reportName":"weekly","rows":500}}'
```

Then use the returned ID at `GET http://localhost:3000/api/jobs/{id}`. `npm test`, `npm run typecheck`, and `npm run build` run API tests, static type checking, and compilation.

## Design overview

See [architecture.md](architecture.md) for component boundaries and the intended queue/worker data flow. The current API behavior is described in [docs/api.md](docs/api.md); implementation decisions and planned failure cases are in [docs/decisions.md](docs/decisions.md) and [docs/failure-scenarios.md](docs/failure-scenarios.md).
