import { CurrentTenant, CurrentUser } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequiresSection } from '../../../common/guards/section.guard';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreateFeeDto, ListFeesQueryDto, UpdateFeeDto } from '../dto';
import { FeesService } from '../service/fees.service';

/** Revenue is the admin's, and of the users the admin gave the Fees page to (see SectionGuard). */
@ApiTags('fees')
@ApiBearerAuth()
@Controller('fees')
@RequiresSection('/fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get()
  list(@CurrentTenant() organisationId: string, @Query() query: ListFeesQueryDto) {
    return this.feesService.list(organisationId, query);
  }

  @Get('overview')
  overview(@CurrentTenant() organisationId: string) {
    return this.feesService.overview(organisationId);
  }

  @Get(':id')
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.feesService.getById(organisationId, id);
  }

  @Post()
  create(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: CreateFeeDto) {
    return this.feesService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateFeeDto) {
    return this.feesService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.feesService.remove(organisationId, user.sub, id);
  }
}
