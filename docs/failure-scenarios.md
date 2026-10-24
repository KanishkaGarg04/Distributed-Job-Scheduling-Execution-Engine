# Failure scenarios (implemented through Milestone 4)

This document separates implemented behavior from recovery work still to do. Redis and PostgreSQL do not share a transaction, and this system does not claim exactly-once execution.

| Failure | Expected concern | Design/verification work |
|---|---|---|
| API unavailable | Clients cannot submit/query during downtime | PostgreSQL records and Redis queue remain independent of API process; restart API. Infrastructure durability depends on each service's configuration |
| Redis unavailable during submission | PostgreSQL insert may already have succeeded | Producer fails promptly; API returns `503 JOB_ENQUEUE_FAILED` with the saved job ID. Record stays `pending`; no automatic re-enqueue exists yet. Operator can inspect it, but a repair endpoint/script is future work |
| PostgreSQL unavailable | API cannot save or read metadata; workers cannot load/update a job | Request fails with `500`; current health endpoint does not detect dependency failure. Worker cannot complete processing without DB access |
| Worker exits during active job | Execution may have started but DB completion may not have been written | BullMQ can recover a stalled delivery when its lock is lost, but this milestone has no retries/backoff policy. A crash can leave DB status `active`; if the handler had side effects, repeating it can duplicate them. M5 will demonstrate and harden this path |
| Handler throws an error | The handler cannot produce a result | Processor records `failed` and its error/duration in PostgreSQL, then rethrows so BullMQ marks that queue attempt failed. No retry is configured yet |
| Queue enqueue succeeds, API DB update fails | Redis has a job while the row may still say `pending` | Worker can run it and update the row. There is a temporary cross-system state gap because PostgreSQL and Redis cannot commit atomically |
| Cancellation after work starts | Arbitrary running work cannot be forcibly undone | Cancellation is not implemented. Future behavior must be best-effort and cooperative |
| Duplicate delivery | The same job can be invoked more than once after crash/recovery | BullMQ job ID avoids duplicate enqueue under that ID while retained, but does not guarantee exactly-once execution or prevent external side effects from repeating. Idempotency/retry policy is future work |

## Current recovery procedure

1. Check `/health` for API process responsiveness, then inspect the job with `GET /api/jobs/:id`.
2. Check API/worker console logs and independently confirm Redis/PostgreSQL availability.
3. A `pending` record after `503` has no automated queue repair in this milestone. Preserve the ID and row; do not blindly resubmit a side-effecting request. Reconciliation tooling is planned for later work.
4. A `failed` record exposes the last handler error. Fix infrastructure or payload causes before manually resubmitting; automatic retries are not enabled yet.
5. An `active` record after abrupt worker termination may be stale; compare queue state and logs. M5 will define recovery behavior more completely.

The implementation should update this document as behaviors become real and should add a recovery procedure for each supported failure case.
