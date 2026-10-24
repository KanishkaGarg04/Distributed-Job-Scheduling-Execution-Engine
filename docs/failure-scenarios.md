# Failure scenarios (design checklist)

These scenarios distinguish current Milestone 3 behavior from behavior still to implement. They are not claims that future recovery behavior already exists.

| Failure | Expected concern | Design/verification work |
|---|---|---|
| API unavailable | Clients cannot submit or query jobs | Current: restart API; persisted PostgreSQL jobs remain available |
| Redis unavailable during submission | Database write may succeed before enqueue fails | Not applicable yet: there is no Redis enqueue path. Later return a clear failure and define recovery |
| PostgreSQL unavailable | API cannot durably accept jobs; workers cannot reliably update metadata | Current: API request fails with generic `500`, and the underlying error is logged. Health readiness is not wired to PostgreSQL yet |
| Worker exits during processing | Queue delivery can be retried; handler may have run partially | Demonstrate redelivery, retries, and duplicate-side-effect limits |
| Handler fails | Retry policy may run it again, then expose terminal failure | Not applicable yet: there is no worker or handler. `JobExecution` is ready to store attempt details later |
| Cancellation after work starts | Arbitrary running work cannot be forcibly undone | Define cancellation as a best-effort request and support cooperative checks |
| Redis and PostgreSQL disagree | Queue state and durable job status may differ temporarily | Expose both where useful and document reconciliation limits |

The implementation should update this document as behaviors become real and should add a recovery procedure for each supported failure case.
