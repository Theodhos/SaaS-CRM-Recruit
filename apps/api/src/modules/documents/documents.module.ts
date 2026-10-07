import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { DocumentsController } from './controller/documents.controller';
import { DocumentsRepository } from './repositories/documents.repository';
import { DocumentsService } from './service/documents.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsService],
})
export class DocumentsModule {}
