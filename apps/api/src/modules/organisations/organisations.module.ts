import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { OrganisationsController } from './controller/organisations.controller';
import { OrganisationsRepository } from './repositories/organisations.repository';
import { OrganisationsService } from './service/organisations.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [OrganisationsController],
  providers: [OrganisationsService, OrganisationsRepository],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
