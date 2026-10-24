# Interview guide

Answers below are grounded in the implementation completed through Milestone 4. Retry/backoff, idempotency, cancellation, monitoring, and automated recovery remain later topics.

## Milestone 2: TypeScript API

### Why use Zod if the code is already TypeScript?

TypeScript checks values while compiling our code. HTTP request bodies arrive at runtime as untrusted JSON, so TypeScript cannot prove that a client sent a valid `reportName` or positive row count. `submitJobSchema` in `src/jobs/job.schema.ts` checks the runtime shape, and `z.infer` gives the service a type derived from that same rule. One definition therefore validates network input and informs compile-time types.

### Why does the route call a service instead of writing all logic in the handler?

`src/api/app.ts` owns HTTP details: status codes, query parsing, and response shapes. `JobService` owns the application action and calls a repository. Keeping these roles separate lets us test the API with a fake repository and change storage without rewriting route behavior.

### What does `202 Accepted` mean here?

It means the request passed validation and a durable database record was created. It does not mean execution has started or completed. Through Milestone 3, the status is `pending`; no queue or worker has been connected yet.

### Why return validation details but hide unexpected errors?

Clients can correct a `400` by reading the validation issues. Database and internal errors should not leak stack traces or credentials in HTTP responses. The error middleware logs the unexpected error server-side and returns a generic `500`. Structured logging will replace the temporary console logger in the operations milestone.

### Why is the job ID a UUID?

It is generated in PostgreSQL through Prisma's `uuid()` default, so each row can be referenced without exposing an increasing global counter. The API validates IDs as UUIDs before querying, returning a client error for malformed IDs and `404` for a well-formed ID that does not exist.

## Milestone 3: PostgreSQL and Prisma

### Why use PostgreSQL as the durable record?

The database stores the request, lifecycle status, outcome/error fields, timestamps, and execution history independently from the future queue. Unlike the previous in-memory `Map`, this record survives an API restart and can be queried consistently by multiple API processes.

### Why separate `Job` and `JobExecution`?

`Job` represents the overall request and its latest status/result. `JobExecution` represents one attempt. A job can have multiple attempts when retries are added, so attempt-specific start/end times and errors belong in separate rows. The unique `(jobId, attemptNumber)` constraint prevents the same attempt number from being recorded twice.

### How do the indexes help this API?

The list endpoint sorts by `createdAt` and `id`, so `Job_createdAt_id_idx` supports that ordered pagination. `(status, createdAt)` supports later filtered status queries; `(type, createdAt)` supports job-type filtering. `JobExecution_jobId_startedAt_idx` supports loading a job's history in time order. Indexes speed reads at a cost: PostgreSQL must also maintain them when rows change, and extra indexes consume storage.

### Where does a transaction help, and what does it guarantee?

The list repository reads the page and total count in a `RepeatableRead` transaction so both values come from one database snapshot. A single submission currently inserts one row, so it does not need a multi-statement transaction. Later, updating a job's state and recording its execution attempt should be one PostgreSQL transaction so those two database changes commit or roll back together.

That transaction still cannot include Redis. Once queueing begins, PostgreSQL and Redis can diverge around enqueue or worker failures. We must document and recover from that cross-system window rather than claim a shared atomic commit.

### Does the current system execute jobs?

Yes, when PostgreSQL and Redis are running and a worker process is started. The API saves and queues the job ID; a separate worker loads the job and runs one of two supported handlers. Retries, cancellation, metrics, and automatic repair of a pending record are not implemented yet.

## Milestone 4: Queue and worker

### Why use a queue instead of executing work in the HTTP request?

The route should answer quickly rather than hold an HTTP connection open while report generation or data processing runs. `POST /api/jobs` validates, saves, enqueues, and returns `202`; the separate worker performs the slower handler. This also lets me add worker processes without increasing API process count.

### Why both PostgreSQL and Redis/BullMQ?

PostgreSQL is the queryable durable application record: it stores request data, current status, outcome, errors, and attempt history. Redis/BullMQ manages delivery, waiting/delayed work, and worker consumption. BullMQ is a queue library built around Redis; it does not replace the application's relational record. The API returns `503` if Redis enqueueing fails after the database insert, leaving a visible pending row.

### What is the difference between queue state and job state?

BullMQ state answers queue questions such as waiting, delayed, active, completed, or failed delivery. The PostgreSQL `Job.status` answers the application's lifecycle question and is what the API reads. They are updated in separate systems, so there is no atomic cross-system transaction. For example, Redis may accept an item just before the API fails to mark PostgreSQL queued. A later milestone adds repair and operational visibility.

### What does worker concurrency mean here?

`WORKER_CONCURRENCY` tells one BullMQ Worker how many asynchronous processor calls it may keep in progress at once. Each demo handler waits asynchronously to make overlap observable. It is not a promise of CPU parallelism: JavaScript CPU-heavy synchronous work still blocks that Node process. Multiple worker processes can consume the same queue; each has its own concurrency limit.

### How does this worker decide what code to run?

BullMQ carries only `{ jobId }`. `createJobProcessor` loads that UUID through `JobService`, checks the stored type and payload again with the Zod schema, then switches to one known handler. The queue is not allowed to carry arbitrary executable code.

### How are results and errors recorded?

The processor records `ACTIVE` plus an attempt row before running. On success, it stores `COMPLETED`, the result, timestamps, and duration. On a handler exception it stores `FAILED`, the message, and duration, then rethrows so BullMQ knows the processor failed. Job summary and attempt history are written together in a PostgreSQL transaction.

### Are retries or exactly-once execution implemented?

No. There is one configured attempt in this milestone; retries/backoff are next. Even with retries, exactly-once side effects cannot generally be promised: a worker can perform an effect and crash before storing completion or acknowledging the message. The same work might then run again. Handlers that affect external systems need idempotency keys or deduplication at the side-effect boundary.

### What happens if a worker is killed?

BullMQ detects loss of a worker's active lock and can recover a stalled queue item according to its queue behavior. This code does not yet configure a deliberate retry policy or repair a PostgreSQL `active` row left by an abrupt crash. If work partially changed an external system, a re-run could repeat that effect. The next reliability milestone will demonstrate this failure window and add retry/backoff and cancellation behavior.

### Why can PostgreSQL and Redis disagree?

They have independent commits: first `repository.create`, then `dispatcher.enqueue`, then `markQueued`. If Redis is unavailable, the first write remains and API returns `503`. If Redis succeeds and the final database write fails, queue work exists even though the API did not finish its status update. An outbox table can make database-to-queue publication recoverable, but still needs a publisher and duplicate-safe consumers; it is intentionally deferred.

### How do priority and delay map to BullMQ?

The API contract says priority 10 is strongest, but BullMQ uses smaller positive values for stronger priority, so `BullMqJobDispatcher` maps it with `11 - priority`. `delaySeconds` is multiplied by 1,000 because BullMQ delay is in milliseconds. Priority changes order among eligible jobs; a delayed job is not eligible until its delay expires.

### How should I run this locally?

Start PostgreSQL and Redis, set `.env`, run `npm run db:migrate`, then start `npm run dev:api` and `npm run dev:worker` in separate terminals. Submit a job and poll `GET /api/jobs/:id`. The full infrastructure demo still needs to be exercised on a machine with both services running; fake-based tests verify the boundaries without those services.

## Later topics

Later milestones will answer: how retries and exponential backoff are configured; how a client idempotency key is scoped; what cancellation can stop; how pending/stale records are reconciled; how health and queue metrics are exposed; how to measure throughput and latency; and how to test worker crash/recovery behavior.
