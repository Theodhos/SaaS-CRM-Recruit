import { Injectable } from '@nestjs/common';

import type { ContactsRepository } from '../repositories/contacts.repository';

@Injectable()
export class ContactsService {
  constructor(private readonly repository: ContactsRepository) {}
}
