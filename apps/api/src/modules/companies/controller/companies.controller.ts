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
import { CreateCompanyDto, ListCompaniesQueryDto, SaveCompanyPipelineRecordDto, UpdateCompanyDto } from '../dto';
import { CompaniesService } from '../service/companies.service';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Permissions(PERMISSIONS.COMPANY.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListCompaniesQueryDto) {
    return this.companiesService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.COMPANY.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.companiesService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.COMPANY.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COMPANY.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(organisationId, user.sub, id, dto);
  }

  /** Pipeline Companies pop-up: the History text of the stages and the pay calculation. */
  @Put(':id/pipeline-record')
  @Permissions(PERMISSIONS.COMPANY.UPDATE)
  savePipelineRecord(
    @CurrentTenant() organisationId: string,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: SaveCompanyPipelineRecordDto,
  ) {
    return this.companiesService.savePipelineRecord(organisationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.COMPANY.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.companiesService.remove(organisationId, user.sub, id);
  }
}
