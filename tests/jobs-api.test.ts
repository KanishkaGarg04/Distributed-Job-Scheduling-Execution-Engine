import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/api/app.js';

describe('jobs API', () => {
  it('accepts a valid report job and returns its ID', async () => {
    const app = createApp();
    const response = await request(app).post('/api/jobs').send({
      type: 'report.generate',
      payload: { reportName: 'weekly', rows: 500 },
    });

    expect(response.status).toBe(202);
    expect(response.body.job).toMatchObject({ type: 'report.generate', status: 'queued', priority: 5 });
    expect(response.body.job.id).toEqual(expect.any(String));
  });

  it('rejects an invalid job payload', async () => {
    const response = await request(createApp()).post('/api/jobs').send({
      type: 'report.generate',
      payload: { reportName: '', rows: -4 },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a submitted job by ID and lists jobs with pagination', async () => {
    const app = createApp();
    const submitted = await request(app).post('/api/jobs').send({
      type: 'data.process',
      payload: { values: [1, 2, 3] },
    });

    const retrieved = await request(app).get(`/api/jobs/${submitted.body.job.id}`);
    const listed = await request(app).get('/api/jobs?limit=1&offset=0');
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.job.id).toBe(submitted.body.job.id);
    expect(listed.body).toMatchObject({ total: 1 });
    expect(listed.body.items).toHaveLength(1);
  });
});
