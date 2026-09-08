import { Injectable } from '@nestjs/common';

import type { CandidatesRepository } from '../repositories/candidates.repository';

@Injectable()
export class CandidatesService {
  constructor(private readonly repository: CandidatesRepository) {}
}
