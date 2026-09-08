import { Public } from '@crm/auth';
import { Controller, Get } from '@nestjs/common';

/** Liveness/readiness probe — intentionally outside the versioned /api/v1 module tree. */
@Controller('health')
export class AppController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
