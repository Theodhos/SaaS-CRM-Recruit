import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import {
  AddTeamMemberDto,
  CreateTeamDto,
  ListTeamsQueryDto,
  UpdateTeamDto,
  UpdateTeamMemberDto,
} from '../dto';
import { TeamsService } from '../service/teams.service';

@ApiTags('teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Permissions(PERMISSIONS.USERS.MANAGE)
  list(@CurrentTenant() organisationId: string, @Query() query: ListTeamsQueryDto) {
    return this.teamsService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.teamsService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.USERS.MANAGE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.USERS.MANAGE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.teamsService.remove(organisationId, user.sub, id);
  }

  @Post(':id/members')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  addMember(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(organisationId, user.sub, id, dto);
  }

  @Patch(':id/members/:userId')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  updateMember(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) memberUserId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateMemberRole(organisationId, user.sub, id, memberUserId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.USERS.MANAGE)
  removeMember(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) memberUserId: string,
  ) {
    return this.teamsService.removeMember(organisationId, user.sub, id, memberUserId);
  }
}
