import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { CalendarController } from './controller/calendar.controller';
import { CalendarRepository } from './repositories/calendar.repository';
import { CalendarRemindersService } from './service/calendar-reminders.service';
import { CalendarService } from './service/calendar.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarRepository, CalendarRemindersService],
  exports: [CalendarService],
})
export class CalendarModule {}
