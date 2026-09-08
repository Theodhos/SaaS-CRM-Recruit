import { Module } from '@nestjs/common';

import { PipelineStagesController } from './controller/pipeline-stages.controller';
import { PipelineStagesRepository } from './repositories/pipeline-stages.repository';
import { PipelineStagesService } from './service/pipeline-stages.service';

@Module({
  controllers: [PipelineStagesController],
  providers: [PipelineStagesService, PipelineStagesRepository],
  exports: [PipelineStagesService],
})
export class PipelineStagesModule {}
