import { Module } from '@nestjs/common';

import { UsersController } from './controller/users.controller';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './service/users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
