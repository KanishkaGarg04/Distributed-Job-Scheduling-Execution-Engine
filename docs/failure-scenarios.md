# Failure scenarios (design checklist)

These are expected behaviors to implement and verify in later milestones. They are not claims about current software behavior.

| Failure | Expected concern | Design/verification work |
|---|---|---|
| API unavailable | Clients cannot submit or query jobs | Restart API; persisted jobs remain in PostgreSQL |
| Redis unavailable during submission | Database write may succeed before enqueue fails | Return a clear failure, mark/reconcile the record, and document retry/recovery |
| PostgreSQL unavailable | API cannot durably accept jobs; workers cannot reliably update metadata | Fail health/readiness and avoid reporting durable success |
| Worker exits during processing | Queue delivery can be retried; handler may have run partially | Demonstrate redelivery, retries, and duplicate-side-effect limits |
| Handler fails | Retry policy may run it again, then expose terminal failure | Store attempts/error details and test configured backoff |
| Cancellation after work starts | Arbitrary running work cannot be forcibly undone | Define cancellation as a best-effort request and support cooperative checks |
| Redis and PostgreSQL disagree | Queue state and durable job status may differ temporarily | Expose both where useful and document reconciliation limits |

The implementation should update this document as behaviors become real and should add a recovery procedure for each supported failure case.
