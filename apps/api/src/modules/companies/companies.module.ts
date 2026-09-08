import { Module } from '@nestjs/common';

import { CompaniesController } from './controller/companies.controller';
import { CompaniesRepository } from './repositories/companies.repository';
import { CompaniesService } from './service/companies.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository],
  exports: [CompaniesService],
})
export class CompaniesModule {}
