import { Injectable } from '@nestjs/common';

import { IntegrationsRepository } from '../repositories/integrations.repository';

@Injectable()
export class IntegrationsService {
  constructor(private readonly repository: IntegrationsRepository) {}
}
