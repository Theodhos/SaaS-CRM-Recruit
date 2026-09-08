import { Module } from '@nestjs/common';

import { DistributionListsController } from './controller/distribution-lists.controller';
import { DistributionListsRepository } from './repositories/distribution-lists.repository';
import { DistributionListsService } from './service/distribution-lists.service';

@Module({
  controllers: [DistributionListsController],
  providers: [DistributionListsService, DistributionListsRepository],
  exports: [DistributionListsService],
})
export class DistributionListsModule {}
