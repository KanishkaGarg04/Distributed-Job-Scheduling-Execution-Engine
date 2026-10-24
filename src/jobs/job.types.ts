import type { SubmitJobInput } from './job.schema.js';

export type JobStatus = 'pending' | 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  type: SubmitJobInput['type'];
  payload: SubmitJobInput['payload'];
  priority: number;
  delaySeconds: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result: unknown | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}
