import { Injectable } from '@nestjs/common';

import { EmailsRepository } from '../repositories/emails.repository';

@Injectable()
export class EmailsService {
  constructor(private readonly repository: EmailsRepository) {}
}
