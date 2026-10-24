import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Job as BullJob, Queue } from 'bullmq';
import request from 'supertest';
import { createApp } from '../src/api/app.js';
import { JobService } from '../src/jobs/job.service.js';
import type { JobRepository } from '../src/jobs/job.repository.js';
import { BullMqJobDispatcher, type JobDispatcher, type QueuedJobData } from '../src/queue/job.queue.js';
import type { JobRecord } from '../src/jobs/job.types.js';
import { createJobProcessor } from '../src/workers/job.processor.js';

function createTestService(dispatcher: JobDispatcher = { async enqueue() {} }) {
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
    async markQueued(id) {
      const job = jobs.get(id);
      if (!job) throw new Error('job missing');
      const queued = { ...job, status: 'queued' as const };
      jobs.set(id, queued);
      return queued;
    },
    async startExecution(id) {
      const job = jobs.get(id);
      if (!job) throw new Error('job missing');
      const active = { ...job, status: 'active' as const };
      jobs.set(id, active);
      return active;
    },
    async completeExecution(id, _attemptNumber, result) {
      const job = jobs.get(id);
      if (!job) throw new Error('job missing');
      const completed = { ...job, status: 'completed' as const, result };
      jobs.set(id, completed);
      return completed;
    },
    async failExecution(id, _attemptNumber, errorMessage) {
      const job = jobs.get(id);
      if (!job) throw new Error('job missing');
      const failed = { ...job, status: 'failed' as const, errorMessage };
      jobs.set(id, failed);
      return failed;
    },
  };
  return new JobService(repository, dispatcher);
}

describe('jobs API', () => {
  it('accepts a valid report job and returns its ID', async () => {
    const app = createApp(createTestService());
    const response = await request(app).post('/api/jobs').send({
      type: 'report.generate',
      payload: { reportName: 'weekly', rows: 500 },
    });

    expect(response.status).toBe(202);
    expect(response.body.job).toMatchObject({ type: 'report.generate', status: 'queued', priority: 5 });
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

  it('returns a clear error if the job record is saved but Redis enqueue fails', async () => {
    const app = createApp(createTestService({ async enqueue() { throw new Error('Redis unavailable'); } }));
    const response = await request(app).post('/api/jobs').send({
      type: 'report.generate',
      payload: { reportName: 'weekly', rows: 500 },
    });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('JOB_ENQUEUE_FAILED');
    expect(response.body.error.jobId).toEqual(expect.any(String));

    const stored = await request(app).get(`/api/jobs/${response.body.error.jobId}`);
    expect(stored.body.job.status).toBe('pending');
  });
});

describe('queue and worker behavior', () => {
  it('maps API priority and delay to BullMQ options', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue<QueuedJobData>;
    const dispatcher = new BullMqJobDispatcher(queue);
    const job: JobRecord = {
      id: randomUUID(), type: 'data.process', payload: { values: [1, 2] },
      priority: 10, delaySeconds: 3, status: 'pending', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), result: null, errorMessage: null,
      startedAt: null, completedAt: null, durationMs: null,
    };

    await dispatcher.enqueue(job);

    expect(add).toHaveBeenCalledWith('execute-job', { jobId: job.id }, {
      jobId: job.id, priority: 1, delay: 3000,
    });
  });

  it('records a successful worker attempt and its result', async () => {
    const service = {
      getById: vi.fn().mockResolvedValue({ type: 'data.process', payload: { values: [2, 4] } }),
      startExecution: vi.fn().mockResolvedValue(undefined),
      completeExecution: vi.fn().mockResolvedValue(undefined),
      failExecution: vi.fn(),
    } as unknown as JobService;
    const queueJob = { data: { jobId: randomUUID() }, attemptsMade: 0 } as BullJob<QueuedJobData>;

    const result = await createJobProcessor(service)(queueJob);

    expect(result).toMatchObject({ count: 2, sum: 6, average: 3 });
    expect(service.startExecution).toHaveBeenCalledWith(queueJob.data.jobId, 1);
    expect(service.completeExecution).toHaveBeenCalledWith(queueJob.data.jobId, 1, result, expect.any(Number));
    expect(service.failExecution).not.toHaveBeenCalled();
  });

  it('records a handler failure before propagating it to BullMQ', async () => {
    const service = {
      getById: vi.fn().mockResolvedValue({ type: 'data.process', payload: { values: [Number.MAX_VALUE, Number.MAX_VALUE] } }),
      startExecution: vi.fn().mockResolvedValue(undefined),
      completeExecution: vi.fn(),
      failExecution: vi.fn().mockResolvedValue(undefined),
    } as unknown as JobService;
    const queueJob = { data: { jobId: randomUUID() }, attemptsMade: 0 } as BullJob<QueuedJobData>;

    await expect(createJobProcessor(service)(queueJob)).rejects.toThrow('outside the supported numeric range');
    expect(service.failExecution).toHaveBeenCalledWith(
      queueJob.data.jobId, 1, 'The sum of the submitted values is outside the supported numeric range', expect.any(Number),
    );
  });
});
