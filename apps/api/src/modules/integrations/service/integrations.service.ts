import { Injectable } from '@nestjs/common';

import type { IntegrationsRepository } from '../repositories/integrations.repository';

@Injectable()
export class IntegrationsService {
  constructor(private readonly repository: IntegrationsRepository) {}
}
