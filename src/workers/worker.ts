import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { PrismaJobRepository } from '../jobs/job.repository.js';
import { JobService } from '../jobs/job.service.js';
import { JOB_QUEUE_NAME, type QueuedJobData } from '../queue/job.queue.js';
import { createJobProcessor } from './job.processor.js';

const service = new JobService(new PrismaJobRepository(prisma));

const worker = new Worker<QueuedJobData>(JOB_QUEUE_NAME, createJobProcessor(service), {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    // Workers stay connected and recover when Redis temporarily returns.
    maxRetriesPerRequest: null,
  },
  concurrency: env.WORKER_CONCURRENCY,
});

worker.on('completed', (job, result) => {
  console.info('Job completed', { jobId: job.data.jobId, result });
});

worker.on('failed', (job, error) => {
  console.error('Job failed', { jobId: job?.data.jobId, error });
});

worker.on('error', (error) => {
  console.error('BullMQ worker error', error);
});

void worker.waitUntilReady().then(() => {
  console.info('Worker is ready', { queue: JOB_QUEUE_NAME, concurrency: env.WORKER_CONCURRENCY });
}).catch((error: unknown) => {
  console.error('Worker could not connect to Redis', error);
  process.exitCode = 1;
});

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.info('Shutting worker down', { signal });
  try {
    await worker.close();
    await prisma.$disconnect();
  } catch (error) {
    console.error('Worker shutdown failed', error);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
