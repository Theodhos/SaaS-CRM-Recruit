import { Injectable } from '@nestjs/common';

import type { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}
}
