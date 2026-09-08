import { Module } from '@nestjs/common';

import { CommentsController } from './controller/comments.controller';
import { CommentsRepository } from './repositories/comments.repository';
import { CommentsService } from './service/comments.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
  exports: [CommentsService],
})
export class CommentsModule {}
