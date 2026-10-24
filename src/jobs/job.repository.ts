import { JobStatus as DatabaseJobStatus, JobType as DatabaseJobType, Prisma, type Job, type PrismaClient } from '@prisma/client';
import type { SubmitJobInput } from './job.schema.js';
import type { JobRecord, JobStatus } from './job.types.js';

export interface JobRepository {
  create(input: SubmitJobInput): Promise<JobRecord>;
  findById(id: string): Promise<JobRecord | undefined>;
  list(limit: number, offset: number): Promise<{ items: JobRecord[]; total: number }>;
  markQueued(id: string): Promise<JobRecord>;
  startExecution(id: string, attemptNumber: number): Promise<JobRecord>;
  completeExecution(id: string, attemptNumber: number, result: unknown, durationMs: number): Promise<JobRecord>;
  failExecution(id: string, attemptNumber: number, errorMessage: string, durationMs: number): Promise<JobRecord>;
}

function toDomainJob(job: Job): JobRecord {
  return {
    id: job.id,
    type: job.type === DatabaseJobType.REPORT_GENERATE ? 'report.generate' : 'data.process',
    payload: job.payload as SubmitJobInput['payload'],
    priority: job.priority,
    delaySeconds: job.delaySeconds,
    status: job.status.toLowerCase() as JobStatus,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    result: job.result,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    durationMs: job.durationMs,
  };
}

export class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: SubmitJobInput): Promise<JobRecord> {
    const row = await this.prisma.job.create({
      data: {
        type: input.type === 'report.generate' ? DatabaseJobType.REPORT_GENERATE : DatabaseJobType.DATA_PROCESS,
        payload: input.payload as Prisma.InputJsonValue,
        priority: input.priority,
        delaySeconds: input.delaySeconds,
        status: DatabaseJobStatus.PENDING,
      },
    });
    return toDomainJob(row);
  }

  async findById(id: string): Promise<JobRecord | undefined> {
    const row = await this.prisma.job.findUnique({ where: { id } });
    return row ? toDomainJob(row) : undefined;
  }

  async list(limit: number, offset: number): Promise<{ items: JobRecord[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        take: limit,
        skip: offset,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.job.count(),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items: rows.map(toDomainJob), total };
  }

  async markQueued(id: string): Promise<JobRecord> {
    // A fast worker may already have advanced this record before the API gets here.
    await this.prisma.job.updateMany({
      where: { id, status: DatabaseJobStatus.PENDING },
      data: { status: DatabaseJobStatus.QUEUED },
    });
    const row = await this.prisma.job.findUnique({ where: { id } });
    if (!row) throw new Error(`Job ${id} disappeared after enqueue`);
    return toDomainJob(row);
  }

  startExecution(id: string, attemptNumber: number): Promise<JobRecord> {
    const startedAt = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.job.update({
        where: { id },
        data: {
          status: DatabaseJobStatus.ACTIVE,
          startedAt,
          completedAt: null,
          durationMs: null,
          errorMessage: null,
        },
      });
      await transaction.jobExecution.upsert({
        where: { jobId_attemptNumber: { jobId: id, attemptNumber } },
        create: { jobId: id, attemptNumber, status: 'STARTED', startedAt },
        update: { status: 'STARTED', startedAt, finishedAt: null, durationMs: null, errorMessage: null },
      });
      return toDomainJob(row);
    });
  }

  completeExecution(id: string, attemptNumber: number, result: unknown, durationMs: number): Promise<JobRecord> {
    const completedAt = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.job.update({
        where: { id },
        data: {
          status: DatabaseJobStatus.COMPLETED,
          result: result as Prisma.InputJsonValue,
          errorMessage: null,
          completedAt,
          durationMs,
        },
      });
      await transaction.jobExecution.update({
        where: { jobId_attemptNumber: { jobId: id, attemptNumber } },
        data: { status: 'SUCCEEDED', finishedAt: completedAt, durationMs },
      });
      return toDomainJob(row);
    });
  }

  failExecution(id: string, attemptNumber: number, errorMessage: string, durationMs: number): Promise<JobRecord> {
    const completedAt = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.job.update({
        where: { id },
        data: { status: DatabaseJobStatus.FAILED, errorMessage, completedAt, durationMs },
      });
      await transaction.jobExecution.update({
        where: { jobId_attemptNumber: { jobId: id, attemptNumber } },
        data: { status: 'FAILED', finishedAt: completedAt, durationMs, errorMessage },
      });
      return toDomainJob(row);
    });
  }
}
