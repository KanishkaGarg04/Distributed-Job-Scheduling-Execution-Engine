# API (Milestone 2)

These endpoints describe the current Express implementation. Responses use JSON. Jobs are currently stored in process memory; `queued` is not evidence of queue delivery or execution. Jobs are lost when the process restarts.

## `POST /api/jobs`

Returns `202 Accepted` with `{ "job": { ... } }` for a valid request.

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

`priority` is an integer from 1 to 10 and defaults to 5. `delaySeconds` is an integer from 0 to 86400 and defaults to 0. The API validates these fields now, but priority and delay have no scheduling effect until the queue milestone.

The returned job includes `id`, `type`, `payload`, `priority`, `delaySeconds`, `status`, and `createdAt`. Current status is always `queued` because no worker exists yet.

Invalid JSON or schema input returns `400`. Schema errors have `{ "error": { "code": "VALIDATION_ERROR", "message": "Request body is invalid", "details": [...] } }`; malformed JSON uses code `INVALID_JSON`.

## `GET /api/jobs/:id`

Returns `200` with `{ "job": ... }`, or `404` with `{ "error": { "code": "JOB_NOT_FOUND", "message": "Job not found" } }`.

## `GET /api/jobs?limit=20&offset=0`

Returns `200` with `{ "items": [...], "total": n }`. `limit` is 1–100 (default 20) and `offset` is a non-negative integer (default 0). Invalid query parameters return `400` with code `VALIDATION_ERROR`.

## `GET /health`

Returns `200` with `{ "status": "ok" }`. This checks only that the API process can answer; there are no external dependencies to check in this milestone.

## Deferred endpoints

Cancellation, queue statistics, and execution results are deferred until the queue, persistence, and worker behavior exist. No Swagger/OpenAPI endpoint is generated yet.
