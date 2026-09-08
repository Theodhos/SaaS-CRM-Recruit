import { Injectable } from '@nestjs/common';

import type { RetainersRepository } from '../repositories/retainers.repository';

@Injectable()
export class RetainersService {
  constructor(private readonly repository: RetainersRepository) {}
}
