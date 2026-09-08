import { Module } from '@nestjs/common';

import { TalentPoolsController } from './controller/talent-pools.controller';
import { TalentPoolsRepository } from './repositories/talent-pools.repository';
import { TalentPoolsService } from './service/talent-pools.service';

@Module({
  controllers: [TalentPoolsController],
  providers: [TalentPoolsService, TalentPoolsRepository],
  exports: [TalentPoolsService],
})
export class TalentPoolsModule {}
