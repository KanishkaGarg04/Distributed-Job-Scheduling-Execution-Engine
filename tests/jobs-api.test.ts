import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/api/app.js';
import { JobService } from '../src/jobs/job.service.js';
import type { JobRepository } from '../src/jobs/job.repository.js';
import type { JobRecord } from '../src/jobs/job.types.js';

function createTestService() {
  const jobs = new Map<string, JobRecord>();
  const repository: JobRepository = {
    async create(input) {
      const now = new Date().toISOString();
      const job: JobRecord = {
        id: randomUUID(),
        type: input.type,
        payload: input.payload,
        priority: input.priority,
        delaySeconds: input.delaySeconds,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        result: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      };
      jobs.set(job.id, job);
      return job;
    },
    async findById(id) {
      return jobs.get(id);
    },
    async list(limit, offset) {
      const allJobs = [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { items: allJobs.slice(offset, offset + limit), total: allJobs.length };
    },
  };
  return new JobService(repository);
}

describe('jobs API', () => {
  it('accepts a valid report job and returns its ID', async () => {
    const app = createApp(createTestService());
    const response = await request(app).post('/api/jobs').send({
      type: 'report.generate',
      payload: { reportName: 'weekly', rows: 500 },
    });

    expect(response.status).toBe(202);
    expect(response.body.job).toMatchObject({ type: 'report.generate', status: 'pending', priority: 5 });
    expect(response.body.job.id).toEqual(expect.any(String));
  });

  it('rejects an invalid job payload', async () => {
    const response = await request(createApp(createTestService())).post('/api/jobs').send({
      type: 'report.generate',
      payload: { reportName: '', rows: -4 },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a submitted job by ID and lists jobs with pagination', async () => {
    const app = createApp(createTestService());
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

  it('rejects a malformed job ID before querying storage', async () => {
    const response = await request(createApp(createTestService())).get('/api/jobs/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JOB_ID');
  });
});
