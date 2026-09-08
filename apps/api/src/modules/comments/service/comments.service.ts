import { Injectable } from '@nestjs/common';

import type { CommentsRepository } from '../repositories/comments.repository';

@Injectable()
export class CommentsService {
  constructor(private readonly repository: CommentsRepository) {}
}
