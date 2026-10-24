import { createApp } from './app.js';
import { env } from '../config/env.js';

const app = createApp();
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
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
