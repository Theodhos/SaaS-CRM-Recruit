import { Module } from '@nestjs/common';

import { OrganisationsController } from './controller/organisations.controller';
import { OrganisationsRepository } from './repositories/organisations.repository';
import { OrganisationsService } from './service/organisations.service';

@Module({
  controllers: [OrganisationsController],
  providers: [OrganisationsService, OrganisationsRepository],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}
