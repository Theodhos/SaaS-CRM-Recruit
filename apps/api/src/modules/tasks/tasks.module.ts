import { Module } from '@nestjs/common';

import { TasksController } from './controller/tasks.controller';
import { TasksRepository } from './repositories/tasks.repository';
import { TasksService } from './service/tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksService],
})
export class TasksModule {}
