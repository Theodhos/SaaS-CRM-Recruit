import { Module } from '@nestjs/common';

import { AnalyticsController } from './controller/analytics.controller';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { AnalyticsService } from './service/analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
