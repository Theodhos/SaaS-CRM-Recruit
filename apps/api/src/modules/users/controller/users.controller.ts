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
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from '../dto';
import { UsersService } from '../service/users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lightweight "assign to" / owner picker (active members only, minimal fields) — used by Candidates/Companies/Contacts/Jobs, not paginated. */
  @Get('active')
  listActive(@CurrentTenant() organisationId: string) {
    return this.usersService.listActiveMembers(organisationId);
  }

  /** Per-user counts of what they own (candidates, companies, jobs, active employees). Admin only; declared before `:id`. */
  @Get('workload')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  workload(@CurrentTenant() organisationId: string) {
    return this.usersService.workload(organisationId);
  }

  @Get()
  @Permissions(PERMISSIONS.USERS.MANAGE)
  list(@CurrentTenant() organisationId: string, @Query() query: ListUsersQueryDto) {
    return this.usersService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.usersService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.USERS.MANAGE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(organisationId, user.sub, id, dto);
  }

  /** Deletes the account for good; what the user added passes to the admin who deletes them. */
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.USERS.MANAGE)
  removePermanently(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.usersService.removePermanently(organisationId, user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.USERS.MANAGE)
  deactivate(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.usersService.deactivate(organisationId, user.sub, id);
  }
}
