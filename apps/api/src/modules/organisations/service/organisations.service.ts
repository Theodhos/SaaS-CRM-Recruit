import { Injectable } from '@nestjs/common';

import type { OrganisationsRepository } from '../repositories/organisations.repository';

@Injectable()
export class OrganisationsService {
  constructor(private readonly repository: OrganisationsRepository) {}
}
