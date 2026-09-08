import { Injectable } from '@nestjs/common';

import type { CompaniesRepository } from '../repositories/companies.repository';

@Injectable()
export class CompaniesService {
  constructor(private readonly repository: CompaniesRepository) {}
}
