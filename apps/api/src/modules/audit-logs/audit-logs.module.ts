import { Module } from '@nestjs/common';

import { AuditLogsController } from './controller/audit-logs.controller';
import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { AuditLogsService } from './service/audit-logs.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsRepository],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
