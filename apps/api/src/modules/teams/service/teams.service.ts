import { Injectable } from '@nestjs/common';

import type { TeamsRepository } from '../repositories/teams.repository';

@Injectable()
export class TeamsService {
  constructor(private readonly repository: TeamsRepository) {}
}
