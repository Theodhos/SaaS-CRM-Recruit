import { Module } from '@nestjs/common';

import { RolesController } from './controller/roles.controller';
import { RolesRepository } from './repositories/roles.repository';
import { RolesService } from './service/roles.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService, RolesRepository],
  exports: [RolesService],
})
export class RolesModule {}
