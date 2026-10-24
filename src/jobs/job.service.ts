import type { JobRepository } from './job.repository.js';
import type { SubmitJobInput } from './job.schema.js';

/** Application rules stay independent from Prisma and the HTTP layer. */
export class JobService {
  constructor(private readonly repository: JobRepository) {}

  submit(input: SubmitJobInput) {
    return this.repository.create(input);
  }

  getById(id: string) {
    return this.repository.findById(id);
  }

  list(limit: number, offset: number) {
    return this.repository.list(limit, offset);
  }
}
