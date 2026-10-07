import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { FeesController } from './controller/fees.controller';
import { FeesRepository } from './repositories/fees.repository';
import { FeesService } from './service/fees.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [FeesController],
  providers: [FeesService, FeesRepository],
  exports: [FeesService],
})
export class FeesModule {}
