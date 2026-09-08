import { Module } from '@nestjs/common';

import { IntegrationsController } from './controller/integrations.controller';
import { IntegrationsRepository } from './repositories/integrations.repository';
import { IntegrationsService } from './service/integrations.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationsRepository],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
