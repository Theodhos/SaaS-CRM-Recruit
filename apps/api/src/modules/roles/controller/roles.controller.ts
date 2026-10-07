import { CurrentTenant } from '@crm/auth';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RolesService } from '../service/roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(@CurrentTenant() organisationId: string) {
    return this.rolesService.list(organisationId);
  }
}
