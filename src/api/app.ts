import express, { type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { JobService } from '../jobs/job.service.js';
import { submitJobSchema } from '../jobs/job.schema.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createApp(jobService = new JobService()) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.post('/api/jobs', (req, res) => {
    const parsed = submitJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request body is invalid', details: parsed.error.issues },
      });
    }
    return res.status(202).json({ job: jobService.submit(parsed.data) });
  });

  app.get('/api/jobs', (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Query parameters are invalid', details: parsed.error.issues },
      });
    }
    return res.status(200).json(jobService.list(parsed.data.limit, parsed.data.offset));
  });

  app.get('/api/jobs/:id', (req, res) => {
    const job = jobService.getById(req.params.id ?? '');
    if (!job) return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
    return res.status(200).json({ job });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } });
    }
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  };
  app.use(errorHandler);
  return app;
}
