import { Injectable } from '@nestjs/common';

import type { AuditLogsRepository } from '../repositories/audit-logs.repository';

@Injectable()
export class AuditLogsService {
  constructor(private readonly repository: AuditLogsRepository) {}
}
