# Distributed Job Scheduler

A learning project for an asynchronous job API and worker system using Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL, and Prisma.

## Current state

Milestone 3 implements a typed Express API, Zod validation, and PostgreSQL persistence through Prisma. Submitted jobs survive API restarts and begin in `pending` status. Redis/BullMQ delivery and execution are not implemented yet; the API is not a running scheduler until those milestones are complete.

## Requirements

- Node.js 22.12 or newer
- npm

## Run locally

```powershell
npm install
npm run dev
```

The API listens on port 3000 by default. Start a local PostgreSQL server, copy `.env.example` to `.env`, and set `DATABASE_URL` for that server. Apply migrations in development with `npm run db:migrate`, then run `npm run dev`. The Docker Compose database setup is planned for the operations milestone.

Example request from another PowerShell window:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs -ContentType 'application/json' -Body '{"type":"report.generate","payload":{"reportName":"weekly","rows":500}}'
```

Then use the returned ID at `GET http://localhost:3000/api/jobs/{id}`. `npm test`, `npm run typecheck`, and `npm run build` run API tests, static type checking (including generated Prisma types), and compilation.

## Design overview

See [architecture.md](architecture.md) for component boundaries and the intended queue/worker data flow. The current API behavior is described in [docs/api.md](docs/api.md); implementation decisions and planned failure cases are in [docs/decisions.md](docs/decisions.md) and [docs/failure-scenarios.md](docs/failure-scenarios.md).
