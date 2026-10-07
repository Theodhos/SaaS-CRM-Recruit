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
import { CreatePlacementDto, ListPlacementsQueryDto, UpdatePlacementDto } from '../dto';
import { PlacementsService } from '../service/placements.service';

@ApiTags('placements')
@ApiBearerAuth()
@Controller('placements')
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Get()
  @Permissions(PERMISSIONS.PLACEMENT.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListPlacementsQueryDto) {
    return this.placementsService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.PLACEMENT.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.placementsService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.PLACEMENT.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreatePlacementDto,
  ) {
    return this.placementsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.PLACEMENT.UPDATE)
  update(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdatePlacementDto,
  ) {
    return this.placementsService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.PLACEMENT.DELETE)
  remove(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseCuidPipe) id: string,
  ) {
    return this.placementsService.remove(organisationId, user.sub, id);
  }
}
