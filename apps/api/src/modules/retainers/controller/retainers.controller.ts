import { CurrentTenant, CurrentUser } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequiresSection } from '../../../common/guards/section.guard';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreateRetainerDto, ListRetainersQueryDto, RenewRetainerDto, UpdateRetainerDto } from '../dto';
import { RetainersService } from '../service/retainers.service';

/** Revenue is the admin's: every route asks for `users:manage`, like the Revenue pages of the web app. */
@ApiTags('retainers')
@ApiBearerAuth()
@Controller('retainers')
@RequiresSection('/retainers')
export class RetainersController {
  constructor(private readonly retainersService: RetainersService) {}

  @Get()
  list(@CurrentTenant() organisationId: string, @Query() query: ListRetainersQueryDto) {
    return this.retainersService.list(organisationId, query);
  }

  @Get('overview')
  overview(@CurrentTenant() organisationId: string) {
    return this.retainersService.overview(organisationId);
  }

  @Get(':id')
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.retainersService.getById(organisationId, id);
  }

  @Post()
  create(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: CreateRetainerDto) {
    return this.retainersService.create(organisationId, user.sub, dto);
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  renew(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: RenewRetainerDto) {
    return this.retainersService.renew(organisationId, user.sub, id, dto);
  }

  @Patch(':id')
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateRetainerDto) {
    return this.retainersService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.retainersService.remove(organisationId, user.sub, id);
  }
}
