import { Module } from '@nestjs/common';

import { ReportsController } from './controller/reports.controller';
import { ReportsRepository } from './repositories/reports.repository';
import { ReportsService } from './service/reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository],
  exports: [ReportsService],
})
export class ReportsModule {}
