import { Module } from '@nestjs/common';

import { PipelinesController } from './controller/pipelines.controller';
import { PipelinesRepository } from './repositories/pipelines.repository';
import { PipelinesService } from './service/pipelines.service';

@Module({
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelinesRepository],
  exports: [PipelinesService],
})
export class PipelinesModule {}
