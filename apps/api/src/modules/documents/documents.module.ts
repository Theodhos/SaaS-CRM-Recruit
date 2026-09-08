import { Module } from '@nestjs/common';

import { DocumentsController } from './controller/documents.controller';
import { DocumentsRepository } from './repositories/documents.repository';
import { DocumentsService } from './service/documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsService],
})
export class DocumentsModule {}
