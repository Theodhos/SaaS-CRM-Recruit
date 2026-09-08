import { Injectable } from '@nestjs/common';

import type { ActivitiesRepository } from '../repositories/activities.repository';

@Injectable()
export class ActivitiesService {
  constructor(private readonly repository: ActivitiesRepository) {}
}
