import { Injectable } from '@nestjs/common';

import type { FeesRepository } from '../repositories/fees.repository';

@Injectable()
export class FeesService {
  constructor(private readonly repository: FeesRepository) {}
}
