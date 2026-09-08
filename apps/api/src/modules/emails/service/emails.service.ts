import { Injectable } from '@nestjs/common';

import type { EmailsRepository } from '../repositories/emails.repository';

@Injectable()
export class EmailsService {
  constructor(private readonly repository: EmailsRepository) {}
}
