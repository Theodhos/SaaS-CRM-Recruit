import { Injectable } from '@nestjs/common';

import { TagsRepository } from '../repositories/tags.repository';

@Injectable()
export class TagsService {
  constructor(private readonly repository: TagsRepository) {}
}
