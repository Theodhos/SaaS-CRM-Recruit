import { CurrentTenant, Permissions } from '@crm/auth';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ReportsService } from '../service/reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Permissions(PERMISSIONS.REPORTS.VIEW)
  overview(@CurrentTenant() organisationId: string) {
    return this.reportsService.overview(organisationId);
  }
}
