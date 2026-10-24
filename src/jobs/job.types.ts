import type { SubmitJobInput } from './job.schema.js';

export type JobStatus = 'queued';

export interface JobRecord {
  id: string;
  type: SubmitJobInput['type'];
  payload: SubmitJobInput['payload'];
  priority: number;
  delaySeconds: number;
  status: JobStatus;
  createdAt: string;
}
