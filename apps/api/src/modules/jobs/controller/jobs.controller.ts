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
import { CreateJobDto, ListJobsQueryDto, UpdateJobDto } from '../dto';
import { JobsService } from '../service/jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Permissions(PERMISSIONS.JOB.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListJobsQueryDto) {
    return this.jobsService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.JOB.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.jobsService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.JOB.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.JOB.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.JOB.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.jobsService.remove(organisationId, user.sub, id);
  }
}
