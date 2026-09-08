import { Module } from '@nestjs/common';

import { TeamsController } from './controller/teams.controller';
import { TeamsRepository } from './repositories/teams.repository';
import { TeamsService } from './service/teams.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}
