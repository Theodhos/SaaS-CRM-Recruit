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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import {
  CreateApplicationDto,
  ListApplicationsQueryDto,
  ToggleChecklistItemDto,
  UpdateApplicationDto,
} from '../dto';
import { UpsertStageNoteDto } from '../dto/stage-note.dto';
import { ApplicationsService } from '../service/applications.service';
import { StageNotesService } from '../service/stage-notes.service';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly stageNotes: StageNotesService,
  ) {}

  @Get()
  @Permissions(PERMISSIONS.APPLICATION.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListApplicationsQueryDto) {
    return this.applicationsService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.APPLICATION.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.applicationsService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.APPLICATION.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(organisationId, user.sub, id, dto);
  }

  /** Undo of DELETE: puts a removed card back on its pipeline. */
  @Post(':id/restore')
  @Permissions(PERMISSIONS.APPLICATION.DELETE)
  restore(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.applicationsService.restore(organisationId, user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.APPLICATION.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.applicationsService.remove(organisationId, user.sub, id);
  }

  /** Every stage of the applicant's pipeline with the notes / pay calculation recorded there. */
  @Get(':id/stage-notes')
  @Permissions(PERMISSIONS.APPLICATION.READ)
  listStageNotes(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.stageNotes.listForApplication(organisationId, id);
  }

  /** Create or update the note for one stage of this application. */
  @Put(':id/stage-notes/:stageId')
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  upsertStageNote(
    @CurrentTenant() organisationId: string,
    @Param('id', ParseCuidPipe) id: string,
    @Param('stageId', ParseCuidPipe) stageId: string,
    @Body() dto: UpsertStageNoteDto,
  ) {
    return this.stageNotes.upsert(organisationId, id, stageId, dto);
  }

  @Patch(':id/checklist-items/:itemId')
  @Permissions(PERMISSIONS.APPLICATION.UPDATE)
  toggleChecklistItem(
    @CurrentTenant() organisationId: string,
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ToggleChecklistItemDto,
  ) {
    return this.applicationsService.toggleChecklistItem(organisationId, id, itemId, dto.completed);
  }
}
