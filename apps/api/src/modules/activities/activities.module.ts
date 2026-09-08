import { Module } from '@nestjs/common';

import { ActivitiesController } from './controller/activities.controller';
import { ActivitiesRepository } from './repositories/activities.repository';
import { ActivitiesService } from './service/activities.service';

@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesRepository],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
