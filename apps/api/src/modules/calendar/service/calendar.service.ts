import { Injectable } from '@nestjs/common';

import type { CalendarRepository } from '../repositories/calendar.repository';

@Injectable()
export class CalendarService {
  constructor(private readonly repository: CalendarRepository) {}
}
