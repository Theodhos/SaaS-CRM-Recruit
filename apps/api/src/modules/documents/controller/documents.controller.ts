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
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreateDocumentDto, ListDocumentsQueryDto } from '../dto';
import { DocumentsService, MAX_UPLOAD_SIZE_BYTES } from '../service/documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Permissions(PERMISSIONS.DOCUMENT.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListDocumentsQueryDto) {
    return this.documentsService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.DOCUMENT.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.documentsService.getById(organisationId, id);
  }

  /** The file itself, to show inside the platform (see DocumentsService.preview). */
  @Get(':id/preview')
  @Permissions(PERMISSIONS.DOCUMENT.READ)
  async preview(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    const { body, contentType } = await this.documentsService.preview(organisationId, id);
    return new StreamableFile(body, { type: contentType, disposition: 'inline' });
  }

  @Post()
  @Permissions(PERMISSIONS.DOCUMENT.CREATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  async upload(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }
    return this.documentsService.upload(organisationId, user.sub, dto, file);
  }

  /**
   * Saves the CV editor's result as a NEW document beside the original (see DocumentsService.saveEdited): every edit
   * leaves both the original and the edited file.
   */
  @Post(':id/edited')
  @Permissions(PERMISSIONS.DOCUMENT.CREATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  saveEdited(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    return this.documentsService.saveEdited(organisationId, user.sub, id, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.DOCUMENT.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.documentsService.remove(organisationId, user.sub, id);
  }
}
