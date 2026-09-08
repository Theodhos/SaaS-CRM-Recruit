import { Module } from '@nestjs/common';

import { PlacementsController } from './controller/placements.controller';
import { PlacementsRepository } from './repositories/placements.repository';
import { PlacementsService } from './service/placements.service';

@Module({
  controllers: [PlacementsController],
  providers: [PlacementsService, PlacementsRepository],
  exports: [PlacementsService],
})
export class PlacementsModule {}
