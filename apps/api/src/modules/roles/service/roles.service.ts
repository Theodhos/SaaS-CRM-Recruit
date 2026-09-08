import { Injectable } from '@nestjs/common';

import type { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}
}
