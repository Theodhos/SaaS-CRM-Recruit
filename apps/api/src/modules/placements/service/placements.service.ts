import { Injectable } from '@nestjs/common';

import type { PlacementsRepository } from '../repositories/placements.repository';

@Injectable()
export class PlacementsService {
  constructor(private readonly repository: PlacementsRepository) {}
}
