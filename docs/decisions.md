# Decision records

## DJS-001: One codebase, separate API and worker processes

**Status:** Implemented in Milestone 4.

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

**Status:** Superseded in Milestone 3.

**Decision:** Use a small `Map`-backed `JobService` so the HTTP contract, validation, and service boundary can be learned and verified before introducing database persistence.

**Reason:** This isolates request validation and API behavior from ORM and infrastructure concerns while keeping this milestone runnable.

**Trade-off:** This was useful only for the first API milestone. It was replaced by PostgreSQL persistence before the API was described as durable.

## DJS-005: Use Express 5, Zod 4, and Vitest

**Status:** Implemented for Milestone 2.

**Decision:** Use Express 5 for HTTP routing, Zod 4 for runtime validation with inferred TypeScript input types, and Vitest with Supertest for API checks. Use TypeScript 5.9 in strict mode; Node.js 22.12+ meets the selected test runner's runtime requirement.

**Reason:** These tools keep the API and test setup small and directly support the project's learning goals. Dependencies are installed from the npm registry and fixed by `package-lock.json`.

## DJS-006: Use Prisma ORM 6.19.3 for the first persistence layer

**Status:** Implemented in Milestone 3.

**Decision:** Pin Prisma CLI and client to 6.19.3. Use Prisma's PostgreSQL connector and generated client directly, without a separate driver adapter.

**Reason:** Prisma 6 is a stable, supported line with the familiar `schema.prisma` datasource URL and migration workflow. It keeps the first database integration focused on schema, migrations, and type-safe queries instead of introducing the Prisma 7 driver-adapter/config changes at the same time.

**Trade-off:** Prisma ORM releases evolve; this version choice should be revisited deliberately rather than upgraded implicitly. The npm lockfile pins transitive dependency versions.

## DJS-007: Keep API status `pending` until a queue exists

**Status:** Historical decision from Milestone 3; superseded by DJS-008.

**Decision:** A successful API submission persists a `PENDING` row. It does not claim queue delivery by labeling the record `QUEUED`.

**Reason:** PostgreSQL writes are currently the only completed step. Queue status should mean BullMQ has accepted delivery once that behavior exists.

**Trade-off:** The row remained pending until the queue milestone introduced a real delivery acknowledgement.

## DJS-008: Use BullMQ 5 for Redis-backed delivery

**Status:** Implemented in Milestone 4.

**Decision:** Use BullMQ `^5.81.5`, with the exact resolved package pinned by `package-lock.json`. The API producer uses short Redis retry behavior so a submit request fails promptly; worker connections are configured to reconnect.

**Reason:** BullMQ handles asynchronous delivery, delayed availability, priority ordering, and consumption while preserving simple API and worker entry points. Version 5 is an established major version for this learning implementation.

**Trade-off:** Redis is required for successful submission. PostgreSQL and Redis do not share a transaction: PostgreSQL is written first, then BullMQ. An enqueue failure leaves a visible pending row and returns `503`; if enqueue succeeds but the final DB status write fails, the worker may still run.

## DJS-009: Store only the job ID in the queue

**Status:** Implemented in Milestone 4.

**Decision:** Queue payload is `{ jobId }`. Worker reloads the canonical job type and payload from PostgreSQL and validates it again before dispatching to a known handler.

**Reason:** Keep queue messages small and avoid two editable copies of the job payload.

**Trade-off:** Workers need PostgreSQL to run jobs. A queue job ID does not promise exactly-once execution or idempotent external effects.

## DJS-010: Persist one execution attempt per worker invocation

**Status:** Implemented in Milestone 4; retry policy deferred.

**Decision:** Store attempt start and finish in `JobExecution`; transactionally update that row and the latest `Job` state/result/error. Handler exceptions are recorded then rethrown to BullMQ.

**Reason:** The job is the overall request, while execution history describes individual tries. The database transaction avoids a half-updated job summary/history pair.

**Trade-off:** Retry/backoff is not configured yet. Abrupt process loss may leave the job marked active until later recovery work addresses it.
