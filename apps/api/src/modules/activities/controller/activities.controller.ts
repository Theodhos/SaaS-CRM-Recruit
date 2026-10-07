import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { CreateActivityDto, ListActivitiesQueryDto, UpdateActivityDto } from '../dto';
import { ActivitiesService } from '../service/activities.service';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @Permissions(PERMISSIONS.ACTIVITY.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListActivitiesQueryDto) {
    return this.activitiesService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ACTIVITY.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.activitiesService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.ACTIVITY.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activitiesService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ACTIVITY.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(organisationId, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ACTIVITY.DELETE)
  remove(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.activitiesService.remove(organisationId, id);
  }
}
