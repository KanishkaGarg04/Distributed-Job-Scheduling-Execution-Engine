# API (Milestone 4)

These endpoints describe the current Express implementation. Responses use JSON. Jobs are stored in PostgreSQL and delivered through BullMQ/Redis. `pending` means the database row exists but enqueueing failed; `queued` means BullMQ accepted the message and execution has not started. Other statuses are `active`, `completed`, and `failed`.

## `POST /api/jobs`

Returns `202 Accepted` with `{ "job": { ... } }` when the database write and queue enqueue succeed. The queue message contains only the job ID; the worker loads and validates the persisted payload before running it. Redis enqueue failure returns `503` with code `JOB_ENQUEUE_FAILED` and a `jobId`; the row remains `pending` for visibility, but automatic reconciliation is not implemented.

Report request:

```json
{
  "type": "report.generate",
  "payload": { "reportName": "weekly", "rows": 500 },
  "priority": 5,
  "delaySeconds": 0
}
```

Data processing request:

```json
{
  "type": "data.process",
  "payload": { "values": [1, 2, 3] }
}
```

`priority` is an integer from 1 to 10 and defaults to 5, with 10 highest. It is translated to BullMQ's numbering when enqueued. `delaySeconds` is an integer from 0 to 86400 and defaults to 0; the worker should not receive the job before its delay expires.

The returned job includes `id`, `type`, `payload`, `priority`, `delaySeconds`, `status`, `createdAt`, `updatedAt`, `result`, `errorMessage`, `startedAt`, `completedAt`, and `durationMs`. Attempt history is stored separately in PostgreSQL but is not exposed by an endpoint yet.

Invalid JSON or schema input returns `400`. Schema errors have `{ "error": { "code": "VALIDATION_ERROR", "message": "Request body is invalid", "details": [...] } }`; malformed JSON uses code `INVALID_JSON`.

## `GET /api/jobs/:id`

Returns `200` with `{ "job": ... }`, `400` if the supplied ID is not a UUID, or `404` with `{ "error": { "code": "JOB_NOT_FOUND", "message": "Job not found" } }`.

## `GET /api/jobs?limit=20&offset=0`

Returns `200` with `{ "items": [...], "total": n }`. `limit` is 1–100 (default 20) and `offset` is a non-negative integer (default 0). Invalid query parameters return `400` with code `VALIDATION_ERROR`.

## `GET /health`

Returns `200` with `{ "status": "ok" }`. It checks only that the API process can answer; it does not probe PostgreSQL or Redis.

## Deferred endpoints

Cancellation, queue statistics, and execution-history retrieval are not implemented yet. No Swagger/OpenAPI endpoint is generated yet. A successful submit confirms queue acceptance, not job completion.
