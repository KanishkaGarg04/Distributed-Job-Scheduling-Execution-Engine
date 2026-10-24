import { createApp } from './app.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { PrismaJobRepository } from '../jobs/job.repository.js';
import { JobService } from '../jobs/job.service.js';

const app = createApp(new JobService(new PrismaJobRepository(prisma)));
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
    void prisma.$disconnect().catch((disconnectError: unknown) => {
      console.error('Failed to disconnect from PostgreSQL cleanly', disconnectError);
      process.exitCode = 1;
    });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
