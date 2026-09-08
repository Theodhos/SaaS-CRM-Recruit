import { Module } from '@nestjs/common';

import { EmailsController } from './controller/emails.controller';
import { EmailsRepository } from './repositories/emails.repository';
import { EmailsService } from './service/emails.service';

@Module({
  controllers: [EmailsController],
  providers: [EmailsService, EmailsRepository],
  exports: [EmailsService],
})
export class EmailsModule {}
