import { Module } from '@nestjs/common';

import { TagsController } from './controller/tags.controller';
import { TagsRepository } from './repositories/tags.repository';
import { TagsService } from './service/tags.service';

@Module({
  controllers: [TagsController],
  providers: [TagsService, TagsRepository],
  exports: [TagsService],
})
export class TagsModule {}
