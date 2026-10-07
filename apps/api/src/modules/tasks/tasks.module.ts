import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { TasksController } from './controller/tasks.controller';
import { TasksRepository } from './repositories/tasks.repository';
import { TasksService } from './service/tasks.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController],
  // TasksRemindersService (overdue-task notifications) is no longer registered: Tasks were removed from the app, so its
  // notifications would link to a page that no longer exists. The Tasks API and existing data are kept.
  providers: [TasksService, TasksRepository],
  exports: [TasksService],
})
export class TasksModule {}
