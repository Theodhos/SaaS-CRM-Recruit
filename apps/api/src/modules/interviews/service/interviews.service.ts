import { Injectable } from '@nestjs/common';

import type { InterviewsRepository } from '../repositories/interviews.repository';

@Injectable()
export class InterviewsService {
  constructor(private readonly repository: InterviewsRepository) {}
}
