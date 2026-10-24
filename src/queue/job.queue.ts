import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import type { JobRecord } from '../jobs/job.types.js';

export const JOB_QUEUE_NAME = 'djs-jobs';

export interface QueuedJobData {
  jobId: string;
}

export function createJobQueue(): Queue<QueuedJobData> {
  const queue = new Queue<QueuedJobData>(JOB_QUEUE_NAME, {
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      // API requests should fail promptly when Redis is unavailable.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
  });
  queue.on('error', (error) => {
    console.error('BullMQ producer queue error', error);
  });
  return queue;
}

export interface JobDispatcher {
  enqueue(job: JobRecord): Promise<void>;
}

export class BullMqJobDispatcher implements JobDispatcher {
  constructor(private readonly queue: Queue<QueuedJobData>) {}

  async enqueue(job: JobRecord): Promise<void> {
    await this.queue.add(
      'execute-job',
      { jobId: job.id },
      {
        // Reusing a database ID avoids adding two queue entries for the same record.
        jobId: job.id,
        // The API presents 10 as highest; BullMQ gives lower numbers higher priority.
        priority: 11 - job.priority,
        delay: job.delaySeconds * 1000,
      },
    );
  }
}
