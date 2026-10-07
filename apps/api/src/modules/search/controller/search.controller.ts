import { CurrentTenant } from '@crm/auth';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GlobalSearchQueryDto } from '../dto/global-search-query.dto';
import { SearchService } from '../service/search.service';

/**
 * The header's global search box — no @Permissions() gate: every result row
 * carries only a name/title and a link, nothing a signed-in org member
 * couldn't already reach by browsing to the relevant list page.
 */
@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentTenant() organisationId: string, @Query() query: GlobalSearchQueryDto) {
    return this.searchService.search(organisationId, query.q);
  }
}
