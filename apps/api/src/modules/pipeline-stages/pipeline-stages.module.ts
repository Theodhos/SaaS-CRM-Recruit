import { Module } from '@nestjs/common';

import { PipelinesModule } from '../pipelines/pipelines.module';

import { PipelineStagesController } from './controller/pipeline-stages.controller';
import { PipelineStagesRepository } from './repositories/pipeline-stages.repository';
import { PipelineStagesService } from './service/pipeline-stages.service';

@Module({
  imports: [PipelinesModule],
  controllers: [PipelineStagesController],
  providers: [PipelineStagesService, PipelineStagesRepository],
  exports: [PipelineStagesService],
})
export class PipelineStagesModule {}
