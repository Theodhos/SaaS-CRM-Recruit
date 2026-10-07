import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UsersModule } from '../users/users.module';

import { TeamsController } from './controller/teams.controller';
import { TeamsRepository } from './repositories/teams.repository';
import { TeamsService } from './service/teams.service';

@Module({
  imports: [AuditLogsModule, UsersModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}
