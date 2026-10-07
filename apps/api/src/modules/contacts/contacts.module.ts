import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompaniesModule } from '../companies/companies.module';

import { ContactsController } from './controller/contacts.controller';
import { ContactsRepository } from './repositories/contacts.repository';
import { ContactsService } from './service/contacts.service';

@Module({
  imports: [AuditLogsModule, CompaniesModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsService],
})
export class ContactsModule {}
