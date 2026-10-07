import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { CompaniesModule } from '../companies/companies.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { PlacementsController } from './controller/placements.controller';
import { PlacementsRepository } from './repositories/placements.repository';
import { PlacementsService } from './service/placements.service';

@Module({
  imports: [AuditLogsModule, CandidatesModule, JobsModule, CompaniesModule, NotificationsModule],
  controllers: [PlacementsController],
  providers: [PlacementsService, PlacementsRepository],
  exports: [PlacementsService],
})
export class PlacementsModule {}
