import { Injectable } from '@nestjs/common';

import type { PipelineStagesRepository } from '../repositories/pipeline-stages.repository';

@Injectable()
export class PipelineStagesService {
  constructor(private readonly repository: PipelineStagesRepository) {}
}
