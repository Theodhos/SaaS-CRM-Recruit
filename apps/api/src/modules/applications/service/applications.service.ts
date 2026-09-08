import { Injectable } from '@nestjs/common';

import type { ApplicationsRepository } from '../repositories/applications.repository';

@Injectable()
export class ApplicationsService {
  constructor(private readonly repository: ApplicationsRepository) {}
}
