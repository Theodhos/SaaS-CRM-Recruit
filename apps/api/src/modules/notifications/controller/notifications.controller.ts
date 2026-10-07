import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ListNotificationsQueryDto } from '../dto';
import { NotificationsService } from '../service/notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Permissions(PERMISSIONS.NOTIFICATION.READ)
  list(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.list(organisationId, user.sub, query);
  }

  @Get('unread-count')
  @Permissions(PERMISSIONS.NOTIFICATION.READ)
  async unreadCount(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload) {
    return { count: await this.notificationsService.unreadCount(organisationId, user.sub) };
  }

  @Patch(':id/read')
  @Permissions(PERMISSIONS.NOTIFICATION.READ)
  markRead(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(organisationId, user.sub, id);
  }

  @Post('read-all')
  @Permissions(PERMISSIONS.NOTIFICATION.READ)
  markAllRead(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload) {
    return this.notificationsService.markAllRead(organisationId, user.sub);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.NOTIFICATION.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.notificationsService.remove(organisationId, user.sub, id);
  }
}
