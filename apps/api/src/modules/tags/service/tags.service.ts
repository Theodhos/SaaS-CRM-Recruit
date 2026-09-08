import { Injectable } from '@nestjs/common';

import type { TagsRepository } from '../repositories/tags.repository';

@Injectable()
export class TagsService {
  constructor(private readonly repository: TagsRepository) {}
}
