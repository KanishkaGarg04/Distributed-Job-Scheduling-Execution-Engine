import type { JobRepository } from './job.repository.js';
import type { SubmitJobInput } from './job.schema.js';
import type { JobDispatcher } from '../queue/job.queue.js';

export class QueueUnavailableError extends Error {
  constructor(readonly jobId: string, cause: unknown) {
    super('The job was saved but could not be added to the queue', { cause });
    this.name = 'QueueUnavailableError';
  }
}

/** Application rules stay independent from Prisma and the HTTP layer. */
export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly dispatcher?: JobDispatcher,
  ) {}

  async submit(input: SubmitJobInput) {
    if (!this.dispatcher) throw new Error('Job submission requires a queue dispatcher');
    const job = await this.repository.create(input);
    try {
      await this.dispatcher.enqueue(job);
    } catch (error) {
      throw new QueueUnavailableError(job.id, error);
    }
    return this.repository.markQueued(job.id);
  }

  getById(id: string) {
    return this.repository.findById(id);
  }

  list(limit: number, offset: number) {
    return this.repository.list(limit, offset);
  }

  startExecution(id: string, attemptNumber: number) {
    return this.repository.startExecution(id, attemptNumber);
  }

  completeExecution(id: string, attemptNumber: number, result: unknown, durationMs: number) {
    return this.repository.completeExecution(id, attemptNumber, result, durationMs);
  }

  failExecution(id: string, attemptNumber: number, errorMessage: string, durationMs: number) {
    return this.repository.failExecution(id, attemptNumber, errorMessage, durationMs);
  }
}
