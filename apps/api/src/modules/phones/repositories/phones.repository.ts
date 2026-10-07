import type { PhoneCallStatus, PhoneImportStatus, Prisma } from '@crm/database';
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CallFilter, ListPhonesQueryDto } from '../dto';

const CALL_INCLUDE = { user: { select: { id: true, firstName: true, lastName: true } } } as const;

const CALL_FILTER_WHERE: Record<Exclude<CallFilter, 'ALL'>, Prisma.PhoneWhereInput> = {
  NEVER_CALLED: { lastCallStatus: null },
  CALLED: { lastCallStatus: { not: null } },
  ANSWERED: { lastCallStatus: 'ANSWERED' },
  NO_ANSWER: { lastCallStatus: 'NO_ANSWER' },
  BUSY: { lastCallStatus: 'BUSY' },
  FAILED: { lastCallStatus: { in: ['FAILED', 'REJECTED'] } },
};

export interface NewPhoneRow {
  name: string | null;
  phone: string;
  normalizedPhone: string;
  email: string | null;
  company: string | null;
  source: string | null;
  importId: string;
  candidateId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
}

/**
 * Tenant-scoped data access for 'phones'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models, except the
 * provider webhook lookups below, which arrive without a tenant and find the
 * call by its provider id first. See docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class PhonesRepository {
  constructor(private readonly db: DatabaseService) {}

  private listWhere(query: ListPhonesQueryDto): Prisma.PhoneWhereInput {
    const digits = query.search?.replace(/\D/g, '') ?? '';
    return {
      deletedAt: null,
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.callFilter && query.callFilter !== 'ALL' ? CALL_FILTER_WHERE[query.callFilter] : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { company: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search } },
              ...(digits.length >= 3 ? [{ normalizedPhone: { contains: digits } }] : []),
            ],
          }
        : {}),
    };
  }

  async findMany(organisationId: string, query: ListPhonesQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = this.listWhere(query);
    const [items, totalItems] = await Promise.all([
      db.phone.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { createdAt: 'desc' } }),
      db.phone.count({ where }),
    ]);
    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).phone.findFirst({
      where: { id, deletedAt: null },
      include: {
        calls: { orderBy: { createdAt: 'desc' }, take: 100, include: CALL_INCLUDE },
        candidate: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        companyRef: { select: { id: true, name: true } },
      },
    });
  }

  softDelete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).phone.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Which of these normalized numbers already exist (any owner — a number is unique per organisation). */
  async findExistingNormalized(organisationId: string, numbers: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (let i = 0; i < numbers.length; i += 1000) {
      const rows = await this.db.forTenant(organisationId).phone.findMany({
        where: { normalizedPhone: { in: numbers.slice(i, i + 1000) } },
        select: { normalizedPhone: true },
      });
      for (const r of rows) found.add(r.normalizedPhone);
    }
    return found;
  }

  /** Batch insert; a number that slipped in meanwhile is skipped, not an error. Returns how many were written. */
  async createMany(organisationId: string, rows: NewPhoneRow[]): Promise<number> {
    const result = await this.db.forTenant(organisationId).phone.createMany({
      data: rows.map((r) => ({ ...r, organisationId })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /** Existing CRM records the file's e-mails / company names point at (spec: associate, never create). */
  async findAssociations(organisationId: string, emails: string[], companyNames: string[]) {
    const db = this.db.forTenant(organisationId);
    const [candidates, contacts, companies] = await Promise.all([
      emails.length ? db.candidate.findMany({ where: { deletedAt: null, email: { in: emails, mode: 'insensitive' } }, select: { id: true, email: true } }) : [],
      emails.length ? db.contact.findMany({ where: { deletedAt: null, email: { in: emails, mode: 'insensitive' } }, select: { id: true, email: true } }) : [],
      companyNames.length ? db.company.findMany({ where: { deletedAt: null, name: { in: companyNames, mode: 'insensitive' } }, select: { id: true, name: true } }) : [],
    ]);
    return {
      candidateByEmail: new Map(candidates.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id])),
      contactByEmail: new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id])),
      companyByName: new Map(companies.map((c) => [c.name.toLowerCase(), c.id])),
    };
  }

  // ---- imports -------------------------------------------------------------------------------------------------

  createImport(organisationId: string, userId: string, data: { fileName: string; defaultCountry: string; totalRows: number; validRows: number; duplicateRows: number; invalidRows: number }) {
    return this.db.forTenant(organisationId).phoneImport.create({ data: { organisationId, userId, ...data } });
  }

  findImport(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).phoneImport.findFirst({ where: { id } });
  }

  updateImport(organisationId: string, id: string, data: { status?: PhoneImportStatus; importedRows?: number; skippedRows?: number; failedRows?: number; errors?: Prisma.InputJsonValue; finishedAt?: Date }) {
    return this.db.forTenant(organisationId).phoneImport.update({ where: { id }, data });
  }

  // ---- calls ---------------------------------------------------------------------------------------------------

  createCall(organisationId: string, data: { phoneId: string; userId: string; provider: string }) {
    return this.db.forTenant(organisationId).phoneCall.create({ data: { organisationId, ...data, status: 'INITIATED', startedAt: new Date() }, include: CALL_INCLUDE });
  }

  findCall(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).phoneCall.findFirst({ where: { id }, include: { ...CALL_INCLUDE, phone: { select: { id: true, normalizedPhone: true, ownerId: true } } } });
  }

  /** Provider webhooks carry no tenant: the call is found by our own id (passed to the provider) or its provider id. */
  findCallForProvider(where: { id?: string; providerCallId?: string }) {
    return this.db.client.phoneCall.findFirst({
      where: where.id ? { id: where.id } : { providerCallId: where.providerCallId },
      include: { phone: { select: { id: true, normalizedPhone: true } } },
    });
  }

  updateCall(organisationId: string, id: string, data: Prisma.PhoneCallUncheckedUpdateInput) {
    return this.db.forTenant(organisationId).phoneCall.update({ where: { id }, data, include: CALL_INCLUDE });
  }

  /** Recomputes the phone's last-call summary from its calls. */
  async refreshPhoneStats(organisationId: string, phoneId: string) {
    const db = this.db.forTenant(organisationId);
    const [count, last] = await Promise.all([
      db.phoneCall.count({ where: { phoneId } }),
      db.phoneCall.findFirst({ where: { phoneId }, orderBy: { createdAt: 'desc' }, select: { status: true, answeredAt: true, createdAt: true } }),
    ]);
    const outcome: PhoneCallStatus | null = !last ? null : last.answeredAt ? 'ANSWERED' : last.status === 'ENDED' ? 'NO_ANSWER' : last.status;
    return db.phone.update({ where: { id: phoneId }, data: { callCount: count, lastCallAt: last?.createdAt ?? null, lastCallStatus: outcome } });
  }
}
