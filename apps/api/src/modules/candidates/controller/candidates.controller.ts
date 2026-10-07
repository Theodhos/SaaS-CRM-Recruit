import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreateCandidateDto, ListCandidatesQueryDto, UpdateCandidateDto } from '../dto';
import { CandidatesService } from '../service/candidates.service';
import { ResumeParserService } from '../service/resume-parser.service';

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

@ApiTags('candidates')
@ApiBearerAuth()
@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly resumeParserService: ResumeParserService,
  ) {}

  @Post('parse-resume')
  @Permissions(PERMISSIONS.CANDIDATE.CREATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_SIZE_BYTES } }))
  async parseResume(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No résumé file was uploaded.');
    }
    const text = await this.resumeParserService.extractText(file);
    return this.resumeParserService.parse(text);
  }

  @Get()
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.candidatesService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.CANDIDATE.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.candidatesService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CANDIDATE.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.candidatesService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.CANDIDATE.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.candidatesService.remove(organisationId, user.sub, id);
  }
}
