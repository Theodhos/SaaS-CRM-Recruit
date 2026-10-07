import { CurrentTenant, Permissions } from '@crm/auth';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ListAuditLogsQueryDto } from '../dto';
import { AuditLogsService } from '../service/audit-logs.service';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @Permissions(PERMISSIONS.SETTINGS.MANAGE)
  list(@CurrentTenant() organisationId: string, @Query() query: ListAuditLogsQueryDto) {
    return this.service.list(organisationId, query);
  }
}
