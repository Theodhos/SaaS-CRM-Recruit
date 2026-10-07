import { CurrentTenant, Permissions } from '@crm/auth';
import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { CreateChecklistItemDto, CreatePipelineStageDto, UpdateChecklistItemDto, UpdatePipelineStageDto } from '../dto';
import { PipelineStagesService } from '../service/pipeline-stages.service';

@ApiTags('pipeline-stages')
@ApiBearerAuth()
@Controller('pipeline-stages')
export class PipelineStagesController {
  constructor(private readonly pipelineStagesService: PipelineStagesService) {}

  @Post()
  @Permissions(PERMISSIONS.APPLICATION.CREATE)
  create(@CurrentTenant() organisationId: string, @Body() dto: CreatePipelineStageDto) {
    return this.pipelineStagesService.create(organisationId, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    return this.pipelineStagesService.update(organisationId, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.APPLICATION.DELETE)
  remove(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.pipelineStagesService.remove(organisationId, id);
  }

  @Post(':stageId/checklist-items')
  @Permissions(PERMISSIONS.APPLICATION.CREATE)
  createChecklistItem(
    @CurrentTenant() organisationId: string,
    @Param('stageId') stageId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.pipelineStagesService.createChecklistItem(organisationId, stageId, dto);
  }

  @Patch('checklist-items/:id')
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  updateChecklistItem(
    @CurrentTenant() organisationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.pipelineStagesService.updateChecklistItem(organisationId, id, dto);
  }

  @Delete('checklist-items/:id')
  @Permissions(PERMISSIONS.APPLICATION.DELETE)
  removeChecklistItem(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.pipelineStagesService.removeChecklistItem(organisationId, id);
  }
}
