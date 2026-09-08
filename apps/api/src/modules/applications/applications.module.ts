import { Module } from '@nestjs/common';

import { ApplicationsController } from './controller/applications.controller';
import { ApplicationsRepository } from './repositories/applications.repository';
import { ApplicationsService } from './service/applications.service';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepository],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
