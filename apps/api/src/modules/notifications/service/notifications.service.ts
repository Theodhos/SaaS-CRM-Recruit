import { Injectable } from '@nestjs/common';

import type { NotificationsRepository } from '../repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}
}
