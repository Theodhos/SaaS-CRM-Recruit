import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { CreateCalendarEventDto, ListCalendarEventsQueryDto, UpdateCalendarEventDto } from '../dto';
import { CalendarService } from '../service/calendar.service';

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @Permissions(PERMISSIONS.CALENDAR.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListCalendarEventsQueryDto) {
    return this.calendarService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CALENDAR.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.calendarService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.CALENDAR.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CALENDAR.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(organisationId, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.CALENDAR.DELETE)
  remove(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.calendarService.remove(organisationId, id);
  }
}
