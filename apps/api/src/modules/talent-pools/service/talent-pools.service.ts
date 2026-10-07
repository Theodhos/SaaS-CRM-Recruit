import { Injectable } from '@nestjs/common';

import { TalentPoolsRepository } from '../repositories/talent-pools.repository';

@Injectable()
export class TalentPoolsService {
  constructor(private readonly repository: TalentPoolsRepository) {}
}
