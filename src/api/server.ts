import { createApp } from './app.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { PrismaJobRepository } from '../jobs/job.repository.js';
import { JobService } from '../jobs/job.service.js';
import { BullMqJobDispatcher, createJobQueue } from '../queue/job.queue.js';

const jobQueue = createJobQueue();
const app = createApp(new JobService(new PrismaJobRepository(prisma), new BullMqJobDispatcher(jobQueue)));
const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; closing API server`);
  server.close((error) => {
    if (error) {
      console.error('Failed to close API server cleanly', error);
      process.exitCode = 1;
    }
    void (async () => {
      try {
        await jobQueue.close();
        await prisma.$disconnect();
      } catch (shutdownError) {
        console.error('Failed to close API dependencies cleanly', shutdownError);
        process.exitCode = 1;
      }
    })();
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
