# Decision records

## DJS-001: One codebase, separate API and worker processes

**Status:** Proposed in Milestone 1.

**Decision:** Keep API and worker as separate process entry points in one modular TypeScript codebase.

**Reason:** The worker can scale independently while the project remains easy for a learner to navigate and run. Microservices would add deployment and network failure modes without helping the initial learning goals.

**Trade-off:** API and worker share a release boundary and codebase.

## DJS-002: PostgreSQL for durable job records; BullMQ/Redis for delivery

**Status:** Proposed in Milestone 1.

**Decision:** Persist the application job record in PostgreSQL and use BullMQ for queueing and scheduling.

**Reason:** Durable queryable job metadata and queue delivery are distinct concerns. Making this distinction helps explain recovery and consistency behavior.

**Trade-off:** There is no atomic transaction spanning PostgreSQL and Redis. The first implementation must handle enqueue failures and duplicate delivery honestly.

## DJS-003: Defer transactional outbox

**Status:** Proposed in Milestone 1.

**Decision:** Begin with database persistence followed by enqueue, and revisit an outbox after the basic flow is implemented.

**Reason:** The initial failure window is an important, concrete learning opportunity; an outbox is a follow-up if stronger eventual delivery is required.

**Trade-off:** A database row can exist without a corresponding queue item if enqueueing fails. The application must make this visible and provide a recovery path.

## DJS-004: Start the API with a temporary in-memory repository

**Status:** Implemented for Milestone 2 only; replace in Milestone 3.

**Decision:** Use a small `Map`-backed `JobService` so the HTTP contract, validation, and service boundary can be learned and verified before introducing database persistence.

**Reason:** This isolates request validation and API behavior from ORM and infrastructure concerns while keeping this milestone runnable.

**Trade-off:** Jobs are lost on API restart, and this API is not yet a durable asynchronous scheduler. `queued` currently describes only the temporary record.

## DJS-005: Use Express 5, Zod 4, and Vitest

**Status:** Implemented for Milestone 2.

**Decision:** Use Express 5 for HTTP routing, Zod 4 for runtime validation with inferred TypeScript input types, and Vitest with Supertest for API checks. Use TypeScript 5.9 in strict mode for a conservative compiler baseline; Node.js 22.12+ meets the selected test runner's runtime requirement.

**Reason:** These tools keep the API and test setup small and directly support the project's learning goals. Dependencies are installed from the npm registry and fixed by `package-lock.json`.
