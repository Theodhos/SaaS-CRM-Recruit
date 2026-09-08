import { Module } from '@nestjs/common';

import { RetainersController } from './controller/retainers.controller';
import { RetainersRepository } from './repositories/retainers.repository';
import { RetainersService } from './service/retainers.service';

@Module({
  controllers: [RetainersController],
  providers: [RetainersService, RetainersRepository],
  exports: [RetainersService],
})
export class RetainersModule {}
