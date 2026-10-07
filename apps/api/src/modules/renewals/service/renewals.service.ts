import { Injectable } from '@nestjs/common';

import { RenewalsRepository } from '../repositories/renewals.repository';

@Injectable()
export class RenewalsService {
  constructor(private readonly repository: RenewalsRepository) {}
}
