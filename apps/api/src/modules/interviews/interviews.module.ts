import { Module } from '@nestjs/common';

import { InterviewsController } from './controller/interviews.controller';
import { InterviewsRepository } from './repositories/interviews.repository';
import { InterviewsService } from './service/interviews.service';

@Module({
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewsRepository],
  exports: [InterviewsService],
})
export class InterviewsModule {}
