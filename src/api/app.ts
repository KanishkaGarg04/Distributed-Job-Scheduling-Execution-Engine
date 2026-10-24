import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { JobService, QueueUnavailableError } from '../jobs/job.service.js';
import { submitJobSchema } from '../jobs/job.schema.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createApp(jobService: JobService) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.post('/api/jobs', async (req, res) => {
    const parsed = submitJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request body is invalid', details: parsed.error.issues },
      });
    }
    const job = await jobService.submit(parsed.data);
    return res.status(202).json({ job });
  });

  app.get('/api/jobs', async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Query parameters are invalid', details: parsed.error.issues },
      });
    }
    const page = await jobService.list(parsed.data.limit, parsed.data.offset);
    return res.status(200).json(page);
  });

  app.get('/api/jobs/:id', async (req, res) => {
    const parsedId = z.uuid().safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: { code: 'INVALID_JOB_ID', message: 'Job ID must be a UUID' } });
    }
    const job = await jobService.getById(parsedId.data);
    if (!job) return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
    return res.status(200).json({ job });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } });
    }
    if (error instanceof QueueUnavailableError) {
      console.error('Could not enqueue persisted job', { jobId: error.jobId, cause: error.cause });
      return res.status(503).json({
        error: {
          code: 'JOB_ENQUEUE_FAILED',
          message: 'The job was saved as pending, but the queue is unavailable',
          jobId: error.jobId,
        },
      });
    }
    console.error('Unhandled API request error', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  };
  app.use(errorHandler);
  return app;
}
