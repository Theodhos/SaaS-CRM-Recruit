import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { CandidatesController } from './controller/candidates.controller';
import { CandidatesRepository } from './repositories/candidates.repository';
import { CandidatesService } from './service/candidates.service';
import { ResumeParserService } from './service/resume-parser.service';

@Module({
  imports: [AuditLogsModule, CompaniesModule, NotificationsModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidatesRepository, ResumeParserService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
