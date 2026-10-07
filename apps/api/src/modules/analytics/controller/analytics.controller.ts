import { CurrentTenant, Permissions } from '@crm/auth';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { AnalyticsService } from '../service/analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard-summary')
  @Permissions(PERMISSIONS.ANALYTICS.VIEW)
  dashboardSummary(@CurrentTenant() organisationId: string) {
    return this.analyticsService.dashboardSummary(organisationId);
  }

  @Get('overview')
  @Permissions(PERMISSIONS.ANALYTICS.VIEW)
  overview(@CurrentTenant() organisationId: string) {
    return this.analyticsService.overview(organisationId);
  }
}
