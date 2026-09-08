import { Injectable } from '@nestjs/common';

import type { DocumentsRepository } from '../repositories/documents.repository';

@Injectable()
export class DocumentsService {
  constructor(private readonly repository: DocumentsRepository) {}
}
