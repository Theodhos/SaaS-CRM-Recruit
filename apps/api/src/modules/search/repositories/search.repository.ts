import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

const LIMIT = 5;

/**
 * The header's global "jump to anything" search — a handful of best matches
 * per entity type, not a full-text index. Every query here is deliberately
 * capped at LIMIT and selects only what a result row needs to render and
 * link, never a full record.
 */
@Injectable()
export class SearchRepository {
  constructor(private readonly db: DatabaseService) {}

  async search(organisationId: string, q: string) {
    const db = this.db.forTenant(organisationId);
    const contains = { contains: q, mode: 'insensitive' as const };

    const [candidates, contacts, companies, jobs] = await Promise.all([
      db.candidate.findMany({
        where: { deletedAt: null, OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] },
        select: { id: true, firstName: true, lastName: true, jobTitle: true },
        take: LIMIT,
      }),
      db.contact.findMany({
        where: {
          deletedAt: null,
          OR: [{ firstName: contains }, { lastName: contains }, { email: contains }],
        },
        select: { id: true, firstName: true, lastName: true, companyId: true, company: { select: { name: true } } },
        take: LIMIT,
      }),
      db.company.findMany({
        where: { deletedAt: null, name: contains },
        select: { id: true, name: true, industry: true },
        take: LIMIT,
      }),
      db.job.findMany({
        where: { deletedAt: null, title: contains },
        select: { id: true, title: true, company: { select: { name: true } } },
        take: LIMIT,
      }),
    ]);

    return { candidates, contacts, companies, jobs };
  }
}
