import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { CompaniesController } from './controller/companies.controller';
import { CompaniesRepository } from './repositories/companies.repository';
import { CompaniesService } from './service/companies.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository],
  exports: [CompaniesService],
})
export class CompaniesModule {}
