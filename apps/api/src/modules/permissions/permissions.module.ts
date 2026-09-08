import { Module } from '@nestjs/common';

import { PermissionsController } from './controller/permissions.controller';
import { PermissionsRepository } from './repositories/permissions.repository';
import { PermissionsService } from './service/permissions.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
