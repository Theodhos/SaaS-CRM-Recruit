import { Module } from '@nestjs/common';

import { FeesController } from './controller/fees.controller';
import { FeesRepository } from './repositories/fees.repository';
import { FeesService } from './service/fees.service';

@Module({
  controllers: [FeesController],
  providers: [FeesService, FeesRepository],
  exports: [FeesService],
})
export class FeesModule {}
