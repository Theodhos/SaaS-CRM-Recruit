import { Injectable } from '@nestjs/common';

import type { TasksRepository } from '../repositories/tasks.repository';

@Injectable()
export class TasksService {
  constructor(private readonly repository: TasksRepository) {}
}
