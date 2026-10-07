import { CurrentTenant, CurrentUser, Permissions, Public } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { CountryCode } from 'libphonenumber-js';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { TwilioVoiceService } from '../../../infrastructure/telephony/twilio-voice.service';
import { ImportPreviewDto, ListPhonesQueryDto, UpdateCallDto } from '../dto';
import { PhonesService } from '../service/phones.service';

const MAX_CSV_BYTES = 50 * 1024 * 1024;

/**
 * /phones — the calling list. Reading and importing carry the contact permissions (a phone list is a contact
 * list); placing and annotating calls needs contact:update, which is the "may call" permission.
 */
@ApiTags('phones')
@ApiBearerAuth()
@Controller('phones')
export class PhonesController {
  constructor(
    private readonly phonesService: PhonesService,
    private readonly telephony: TwilioVoiceService,
  ) {}

  @Get('capabilities')
  @Permissions(PERMISSIONS.CONTACT.READ)
  capabilities() {
    return this.phonesService.capabilities();
  }

  @Get()
  @Permissions(PERMISSIONS.CONTACT.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListPhonesQueryDto) {
    return this.phonesService.list(organisationId, query);
  }

  @Post('imports/preview')
  @Permissions(PERMISSIONS.CONTACT.CREATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES } }))
  previewImport(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: ImportPreviewDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No Excel file was uploaded.');
    return this.phonesService.previewImport(organisationId, user.sub, file, (dto.defaultCountry ?? 'AL') as CountryCode);
  }

  @Post('imports/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.CONTACT.CREATE)
  confirmImport(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.phonesService.confirmImport(organisationId, user.sub, id);
  }

  @Get('imports/:id')
  @Permissions(PERMISSIONS.CONTACT.READ)
  getImport(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.phonesService.getImport(organisationId, id);
  }

  @Get('imports/:id/errors')
  @Permissions(PERMISSIONS.CONTACT.READ)
  errorReport(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.phonesService.errorReport(organisationId, id);
  }

  // ---- calls -----------------------------------------------------------------------------------------------------

  /** Twilio fetches this when the browser dials (TwiML App voice URL). Public; verified by signature when configured. */
  @Public()
  @Post('calls/twiml')
  async twiml(@Req() req: Request, @Res() res: Response, @Body() body: Record<string, string>, @Headers('x-twilio-signature') signature?: string) {
    const url = `${this.telephony.publicApiUrl()}${req.originalUrl}`;
    if (!this.telephony.validateSignature(url, body, signature)) {
      res.status(HttpStatus.FORBIDDEN).type('text/xml').send(this.telephony.rejectTwiml('Unauthorised.'));
      return;
    }
    res.type('text/xml').send(await this.phonesService.twiml(body));
  }

  /** Twilio's status callbacks (initiated / ringing / answered / completed / busy / failed / no-answer). */
  @Public()
  @Post('calls/webhook')
  async webhook(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: Record<string, string>,
    @Query('callId') callId?: string,
    @Headers('x-twilio-signature') signature?: string,
  ) {
    const url = `${this.telephony.publicApiUrl()}${req.originalUrl}`;
    if (!this.telephony.validateSignature(url, body, signature)) {
      res.status(HttpStatus.FORBIDDEN).send();
      return;
    }
    await this.phonesService.webhook(callId, body);
    res.status(HttpStatus.NO_CONTENT).send();
  }

  @Patch('calls/:id')
  @Permissions(PERMISSIONS.CONTACT.UPDATE)
  updateCall(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateCallDto) {
    return this.phonesService.updateCall(organisationId, id, dto);
  }

  @Post(':id/calls')
  @Permissions(PERMISSIONS.CONTACT.UPDATE)
  startCall(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.phonesService.startCall(organisationId, user.sub, id);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CONTACT.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.phonesService.getById(organisationId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.CONTACT.DELETE)
  remove(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.phonesService.remove(organisationId, user.sub, id);
  }
}
