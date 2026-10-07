import { Injectable } from '@nestjs/common';

import { DistributionListsRepository } from '../repositories/distribution-lists.repository';

@Injectable()
export class DistributionListsService {
  constructor(private readonly repository: DistributionListsRepository) {}
}
