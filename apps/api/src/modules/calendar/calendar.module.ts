import { Module } from '@nestjs/common';

import { CalendarController } from './controller/calendar.controller';
import { CalendarRepository } from './repositories/calendar.repository';
import { CalendarService } from './service/calendar.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService, CalendarRepository],
  exports: [CalendarService],
})
export class CalendarModule {}
