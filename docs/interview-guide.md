# Interview guide (to be grounded in implemented code)

This guide will be completed as implementation decisions become observable in code. The questions below are the concepts the project should be able to demonstrate.

- Why is job work placed behind an asynchronous queue instead of run inside the HTTP request?
- What responsibilities belong to BullMQ/Redis, and which belong to PostgreSQL?
- What does worker concurrency mean, and what limits it?
- How can a worker crash lead to a job being delivered more than once?
- What does retry with exponential backoff do, and how can retrying make side effects repeat?
- What can an idempotency key prevent, and what does it not guarantee?
- Why can PostgreSQL and Redis disagree, and how does the implementation recover?
- What can cancellation stop before work begins, and what requires cooperation from a running handler?
- How would measurements guide changes if job volume grew by 10x?

Answers should point to the relevant route, service, worker, schema, tests, and documentation rather than rely on memorized definitions.
