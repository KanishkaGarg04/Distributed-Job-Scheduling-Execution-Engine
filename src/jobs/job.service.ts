import { randomUUID } from 'node:crypto';
import type { JobRecord } from './job.types.js';
import type { SubmitJobInput } from './job.schema.js';

/** Temporary process-local store. PostgreSQL replaces this in Milestone 3. */
export class JobService {
  private readonly jobs = new Map<string, JobRecord>();

  submit(input: SubmitJobInput): JobRecord {
    const job: JobRecord = {
      id: randomUUID(),
      type: input.type,
      payload: input.payload,
      priority: input.priority,
      delaySeconds: input.delaySeconds,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  getById(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  list(limit: number, offset: number): { items: JobRecord[]; total: number } {
    const allJobs = [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: allJobs.slice(offset, offset + limit), total: allJobs.length };
  }
}
