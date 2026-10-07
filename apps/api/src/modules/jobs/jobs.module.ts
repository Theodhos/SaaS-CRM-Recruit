import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompaniesModule } from '../companies/companies.module';

import { JobsController } from './controller/jobs.controller';
import { JobsRepository } from './repositories/jobs.repository';
import { JobsService } from './service/jobs.service';

@Module({
  imports: [AuditLogsModule, CompaniesModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository],
  exports: [JobsService],
})
export class JobsModule {}
