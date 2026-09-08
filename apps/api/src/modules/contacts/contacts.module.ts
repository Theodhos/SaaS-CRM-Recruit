import { Module } from '@nestjs/common';

import { ContactsController } from './controller/contacts.controller';
import { ContactsRepository } from './repositories/contacts.repository';
import { ContactsService } from './service/contacts.service';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsService],
})
export class ContactsModule {}
