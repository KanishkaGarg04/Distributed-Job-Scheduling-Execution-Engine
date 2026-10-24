import { JobStatus as DatabaseJobStatus, JobType as DatabaseJobType, Prisma, type Job, type PrismaClient } from '@prisma/client';
import type { SubmitJobInput } from './job.schema.js';
import type { JobRecord, JobStatus } from './job.types.js';

export interface JobRepository {
  create(input: SubmitJobInput): Promise<JobRecord>;
  findById(id: string): Promise<JobRecord | undefined>;
  list(limit: number, offset: number): Promise<{ items: JobRecord[]; total: number }>;
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
}
