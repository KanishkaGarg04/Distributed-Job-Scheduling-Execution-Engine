# Interview guide

Answers below are grounded in the implementation completed through Milestone 3. Queue and worker questions remain planned topics until those components are implemented.

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

No. The API persists `pending` records and can read/list them. Queue delivery, execution, retries, cancellation, and results are not implemented yet. A `JobExecution` schema exists for the later worker to write, but no attempt rows are created today.

## Later queue and worker topics

- Why use BullMQ/Redis in addition to PostgreSQL?
- What does worker concurrency mean, and what limits it?
- How can a worker crash lead to a job being delivered more than once?
- What does exponential retry backoff do, and how can retries repeat side effects?
- What can an idempotency key prevent, and what does it not guarantee?
- Why can PostgreSQL and Redis disagree, and how does the implementation recover?
- What can cancellation stop before work begins, and what requires a cooperative handler?
- How would measurements guide changes if job volume grew by 10x?
