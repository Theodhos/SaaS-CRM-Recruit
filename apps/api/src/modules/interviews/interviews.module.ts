import { Module } from '@nestjs/common';

import { ApplicationsModule } from '../applications/applications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CalendarModule } from '../calendar/calendar.module';
import { UsersModule } from '../users/users.module';

import { InterviewsController } from './controller/interviews.controller';
import { InterviewsRepository } from './repositories/interviews.repository';
import { InterviewsService } from './service/interviews.service';

// EmailModule and ZoomModule are global (infrastructure).
@Module({
  imports: [ApplicationsModule, AuditLogsModule, CalendarModule, UsersModule],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewsRepository],
  exports: [InterviewsService],
})
export class InterviewsModule {}
