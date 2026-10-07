import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { ListInterviewsQueryDto, ScheduleInterviewDto } from '../dto';
import { InterviewsService } from '../service/interviews.service';

/** Interviews hang off applications, so they carry the application permissions. */
@ApiTags('interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get('capabilities')
  @Permissions(PERMISSIONS.APPLICATION.READ)
  capabilities() {
    return this.interviewsService.capabilities();
  }

  @Get()
  @Permissions(PERMISSIONS.APPLICATION.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListInterviewsQueryDto) {
    return this.interviewsService.list(organisationId, query);
  }

  @Post()
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  schedule(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: ScheduleInterviewDto) {
    return this.interviewsService.schedule(organisationId, user.sub, dto);
  }

  @Post(':id/send-invite')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  sendInvite(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.interviewsService.sendInvite(organisationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  remove(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.interviewsService.remove(organisationId, user.sub, id);
  }
}
