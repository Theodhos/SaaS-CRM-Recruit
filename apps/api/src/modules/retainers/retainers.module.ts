import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { RetainersController } from './controller/retainers.controller';
import { RetainersRepository } from './repositories/retainers.repository';
import { RetainersService } from './service/retainers.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [RetainersController],
  providers: [RetainersService, RetainersRepository],
  exports: [RetainersService],
})
export class RetainersModule {}
