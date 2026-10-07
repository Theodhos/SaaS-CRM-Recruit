import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { PhonesController } from './controller/phones.controller';
import { PhonesRepository } from './repositories/phones.repository';
import { PhonesService } from './service/phones.service';

// TelephonyModule (Twilio) is global infrastructure.
@Module({
  imports: [AuditLogsModule],
  controllers: [PhonesController],
  providers: [PhonesService, PhonesRepository],
  exports: [PhonesService],
})
export class PhonesModule {}
