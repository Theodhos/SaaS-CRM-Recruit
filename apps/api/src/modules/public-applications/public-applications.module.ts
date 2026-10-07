import { Module } from '@nestjs/common';

import { ApplicationsModule } from '../applications/applications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { PublicApplicationsController } from './controller/public-applications.controller';
import { PublicApplicationsService } from './service/public-applications.service';

@Module({
  imports: [AuditLogsModule, ApplicationsModule],
  controllers: [PublicApplicationsController],
  providers: [PublicApplicationsService],
})
export class PublicApplicationsModule {}
