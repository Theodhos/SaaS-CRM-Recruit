import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PipelineStagesModule } from '../pipeline-stages/pipeline-stages.module';
import { PlacementsModule } from '../placements/placements.module';
import { UsersModule } from '../users/users.module';

import { ApplicationsController } from './controller/applications.controller';
import { ApplicationsRepository } from './repositories/applications.repository';
import { ApplicationsService } from './service/applications.service';
import { CandidateIntakeService } from './service/candidate-intake.service';
import { StageNotesService } from './service/stage-notes.service';

@Module({
  imports: [AuditLogsModule, CandidatesModule, JobsModule, PlacementsModule, PipelineStagesModule, NotificationsModule, UsersModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepository, StageNotesService, CandidateIntakeService],
  exports: [ApplicationsService, CandidateIntakeService],
})
export class ApplicationsModule {}
