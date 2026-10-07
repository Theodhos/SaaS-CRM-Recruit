import { offsetToSkipTake, totalPages } from '@crm/utils';
import { Injectable, Logger } from '@nestjs/common';

import { AuditLogsRepository } from '../repositories/audit-logs.repository';

export interface RecordAuditInput {
  organisationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
}

/**
 * Shared audit-trail writer, injected into every domain service that
 * performs a create/update/delete a real user should be able to trace
 * later (see docs section on AuditLog / spec §44). Deliberately
 * best-effort: a failed audit write is logged, not rethrown — logging a
 * side effect must never roll back or block the primary business
 * operation it's describing.
 */
@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly repository: AuditLogsRepository) {}

  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.repository.create(input);
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log for ${input.action} ${input.entityType}:${input.entityId} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(organisationId: string, params: { page: number; pageSize: number }) {
    const { skip, take } = offsetToSkipTake(params);
    const { items, totalItems } = await this.repository.findMany(organisationId, { skip, take });
    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, params.pageSize),
    };
  }
}
