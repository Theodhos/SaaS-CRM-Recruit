import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { UpdateOrganisationDto } from '../dto';
import { OrganisationsService } from '../service/organisations.service';

/** The signed-in user's own organisation — there is no route that names another one. */
@ApiTags('organisations')
@ApiBearerAuth()
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  /** Name and pay defaults: everyone reads them (the pay calculation starts from them). */
  @Get('current')
  current(@CurrentTenant() organisationId: string) {
    return this.organisationsService.current(organisationId);
  }

  @Patch('current')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: UpdateOrganisationDto) {
    return this.organisationsService.update(organisationId, user.sub, dto);
  }

  @Get('current/integrations')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  integrations() {
    return this.organisationsService.integrations();
  }
}
