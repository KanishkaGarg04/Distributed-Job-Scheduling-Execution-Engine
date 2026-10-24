import type { Job as BullJob } from 'bullmq';
import { performance } from 'node:perf_hooks';
import { submitJobSchema } from '../jobs/job.schema.js';
import type { JobService } from '../jobs/job.service.js';
import type { QueuedJobData } from '../queue/job.queue.js';

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runKnownHandler(type: string, payload: unknown): Promise<Record<string, unknown>> {
  const parsed = submitJobSchema.safeParse({ type, payload });
  if (!parsed.success) {
    throw new Error(`Stored job payload failed validation for job type ${type}`);
  }

  switch (parsed.data.type) {
    case 'report.generate':
      await sleep(500); // Simulated async work so queue and concurrency behavior can be observed.
      return {
        reportName: parsed.data.payload.reportName,
        rowsGenerated: parsed.data.payload.rows,
        generatedAt: new Date().toISOString(),
      };
    case 'data.process': {
      await sleep(100);
      const sum = parsed.data.payload.values.reduce((total, value) => total + value, 0);
      if (!Number.isFinite(sum)) throw new Error('The sum of the submitted values is outside the supported numeric range');
      return {
        count: parsed.data.payload.values.length,
        sum,
        average: sum / parsed.data.payload.values.length,
      };
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Job failed with a non-Error value';
}

export function createJobProcessor(service: JobService) {
  return async (queueJob: BullJob<QueuedJobData>): Promise<Record<string, unknown>> => {
    const { jobId } = queueJob.data;
    const job = await service.getById(jobId);
    if (!job) throw new Error(`No PostgreSQL job record exists for queue item ${jobId}`);

    const attemptNumber = queueJob.attemptsMade + 1;
    const startedAt = performance.now();
    await service.startExecution(jobId, attemptNumber);

    let result: Record<string, unknown>;
    try {
      result = await runKnownHandler(job.type, job.payload);
    } catch (error) {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      try {
        await service.failExecution(jobId, attemptNumber, errorMessage(error), durationMs);
      } catch (recordingError) {
        throw new AggregateError([error, recordingError], 'Job failed and its failure could not be recorded');
      }
      throw error;
    }

    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    await service.completeExecution(jobId, attemptNumber, result, durationMs);
    return result;
  };
}
