import { Public } from '@crm/auth';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WebsiteApplicationDto } from '../dto/website-application.dto';
import { PublicApplicationsService } from '../service/public-applications.service';

@ApiTags('public')
@Controller('public')
export class PublicApplicationsController {
  constructor(private readonly service: PublicApplicationsService) {}

  @ApiOperation({
    summary: 'Submit an application from a public website',
    description:
      'Unauthenticated. Creates (or updates) a Candidate for the organisation named by `organisation`; it then appears in Candidates ranked by potential. See docs/api/public-applications.md.',
  })
  @Public()
  // Tight per-client limit: this is the one endpoint anyone on the internet can write through.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('applications')
  @HttpCode(201)
  submit(@Body() dto: WebsiteApplicationDto) {
    return this.service.submit(dto);
  }
}
