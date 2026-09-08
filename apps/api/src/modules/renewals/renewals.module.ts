import { Module } from '@nestjs/common';

import { RenewalsController } from './controller/renewals.controller';
import { RenewalsRepository } from './repositories/renewals.repository';
import { RenewalsService } from './service/renewals.service';

@Module({
  controllers: [RenewalsController],
  providers: [RenewalsService, RenewalsRepository],
  exports: [RenewalsService],
})
export class RenewalsModule {}
