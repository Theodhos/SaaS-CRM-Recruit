import { Module } from '@nestjs/common';

import { JobsController } from './controller/jobs.controller';
import { JobsRepository } from './repositories/jobs.repository';
import { JobsService } from './service/jobs.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobsRepository],
  exports: [JobsService],
})
export class JobsModule {}
