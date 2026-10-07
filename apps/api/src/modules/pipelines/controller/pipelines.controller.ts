import { CurrentTenant, Permissions } from '@crm/auth';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { CreatePipelineDto, UpdatePipelineDto } from '../dto';
import { PipelinesService } from '../service/pipelines.service';

@ApiTags('pipelines')
@ApiBearerAuth()
@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  @Permissions(PERMISSIONS.APPLICATION.READ)
  list(@CurrentTenant() organisationId: string) {
    return this.pipelinesService.list(organisationId);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.APPLICATION.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.pipelinesService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.APPLICATION.CREATE)
  create(@CurrentTenant() organisationId: string, @Body() dto: CreatePipelineDto) {
    return this.pipelinesService.create(organisationId, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.pipelinesService.update(organisationId, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.APPLICATION.DELETE)
  remove(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.pipelinesService.remove(organisationId, id);
  }
}
