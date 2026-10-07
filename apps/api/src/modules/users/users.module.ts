import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RolesModule } from '../roles/roles.module';

import { UsersController } from './controller/users.controller';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './service/users.service';

@Module({
  imports: [AuditLogsModule, RolesModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
