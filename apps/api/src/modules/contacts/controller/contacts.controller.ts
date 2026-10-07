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
import { CreateContactDto, ListContactsQueryDto, UpdateContactDto } from '../dto';
import { ContactsService } from '../service/contacts.service';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @Permissions(PERMISSIONS.CONTACT.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListContactsQueryDto) {
    return this.contactsService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CONTACT.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.contactsService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.CONTACT.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CONTACT.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.CONTACT.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.contactsService.remove(organisationId, user.sub, id);
  }
}
