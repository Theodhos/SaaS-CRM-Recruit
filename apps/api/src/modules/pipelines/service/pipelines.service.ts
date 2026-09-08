import { Injectable } from '@nestjs/common';

import type { PipelinesRepository } from '../repositories/pipelines.repository';

@Injectable()
export class PipelinesService {
  constructor(private readonly repository: PipelinesRepository) {}
}
