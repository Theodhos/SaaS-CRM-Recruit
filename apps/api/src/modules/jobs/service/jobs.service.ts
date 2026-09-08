import { Injectable } from '@nestjs/common';

import type { JobsRepository } from '../repositories/jobs.repository';

@Injectable()
export class JobsService {
  constructor(private readonly repository: JobsRepository) {}
}
