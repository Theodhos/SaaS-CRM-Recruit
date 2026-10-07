import type { UserStatus } from '@crm/database';
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { ListUsersQueryDto } from '../dto/list-users-query.dto';

// `select` (not `include`) deliberately — `include` adds the role relation
// on top of every scalar column, which would leak `passwordHash` to every
// caller of this repository (including the API responses these methods
// back directly). Every field the app actually needs, and nothing else.
const USER_SELECT = {
  id: true,
  organisationId: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  status: true,
  allowedSections: true,
  loginOtpEnabled: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  teamMemberships: { select: { team: { select: { id: true, name: true } } } },
} as const;

/**
 * Tenant-scoped data access for 'users'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Active holders of `users:manage` — the admins who are told about organisation-wide events such as a new candidate arriving. */
  findAdminIds(organisationId: string) {
    return this.db.forTenant(organisationId).user.findMany({
      where: { status: 'ACTIVE', role: { rolePermissions: { some: { permission: { key: 'users:manage' } } } } },
      select: { id: true },
    });
  }

  /** Populates "assign to" / owner pickers across Candidates/Companies/Contacts/Jobs — active members only, deliberately unfiltered otherwise. */
  findActiveOrgMembers(organisationId: string) {
    return this.db.forTenant(organisationId).user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, status: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findMany(organisationId: string, query: ListUsersQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.user.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: USER_SELECT,
      }),
      db.user.count({ where }),
    ]);

    return { items, totalItems };
  }

  /**
   * What each user has built: the live candidates, companies and jobs they own, and the active placements
   * ("active employees") of their candidates — the same records that user sees in their own account.
   */
  async workload(organisationId: string) {
    const db = this.db.forTenant(organisationId);
    const users = await db.user.findMany({ select: { id: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] });
    const [candidates, companies, jobs, placements] = await Promise.all([
      db.candidate.groupBy({ by: ['ownerId'], where: { deletedAt: null }, _count: { _all: true } }),
      db.company.groupBy({ by: ['ownerId'], where: { deletedAt: null }, _count: { _all: true } }),
      db.job.groupBy({ by: ['ownerId'], where: { deletedAt: null }, _count: { _all: true } }),
      Promise.all(
        users.map((u) =>
          db.placement
            .count({ where: { status: 'ACTIVE', candidate: { ownerId: u.id } } })
            .then((count) => [u.id, count] as const),
        ),
      ),
    ]);
    const byOwner = (rows: { ownerId: string | null; _count: { _all: number } }[]) =>
      new Map(rows.filter((r) => r.ownerId).map((r) => [r.ownerId as string, r._count._all]));
    const c = byOwner(candidates), co = byOwner(companies), j = byOwner(jobs), p = new Map(placements);
    return users.map((u) => ({
      userId: u.id,
      candidates: c.get(u.id) ?? 0,
      companies: co.get(u.id) ?? 0,
      jobs: j.get(u.id) ?? 0,
      activeEmployees: p.get(u.id) ?? 0,
    }));
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).user.findFirst({
      where: { id },
      select: USER_SELECT,
    });
  }

  findByEmail(organisationId: string, email: string) {
    return this.db.forTenant(organisationId).user.findFirst({ where: { email } });
  }

  create(
    organisationId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      roleId: string;
      passwordHash: string;
      status?: UserStatus;
      allowedSections?: string[];
      loginOtpEnabled?: boolean;
    },
  ) {
    return this.db.forTenant(organisationId).user.create({
      data: { ...data, organisationId },
      select: USER_SELECT,
    });
  }

  update(
    organisationId: string,
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      roleId?: string;
      status?: UserStatus;
      avatarUrl?: string;
      passwordHash?: string;
      allowedSections?: string[];
      loginOtpEnabled?: boolean;
    },
  ) {
    return this.db.forTenant(organisationId).user.update({
      where: { id },
      data: { ...data },
      select: USER_SELECT,
    });
  }

  /** Accounts that hold `users:manage` and can still sign in, oldest first — the first one is the organisation's owner. */
  findAdmins(organisationId: string) {
    return this.db.forTenant(organisationId).user.findMany({
      where: { status: { not: 'DEACTIVATED' }, role: { rolePermissions: { some: { permission: { key: 'users:manage' } } } } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Whether this role makes its holder an admin. */
  async isAdminRole(organisationId: string, roleId: string): Promise<boolean> {
    const count = await this.db.forTenant(organisationId).role.count({
      where: { id: roleId, rolePermissions: { some: { permission: { key: 'users:manage' } } } },
    });
    return count > 0;
  }

  /**
   * Deletes the account for good. What the user added is not lost: their companies, candidates, jobs, … and the
   * history that must keep an author (activities, calendar, calls) pass to `heirId`, the admin who deletes them.
   * One transaction — a user is never left half-removed.
   */
  async deletePermanently(organisationId: string, id: string, heirId: string): Promise<void> {
    const db = this.db.client;
    const owned = { where: { organisationId, ownerId: id }, data: { ownerId: heirId } };
    await db.$transaction([
      db.company.updateMany(owned),
      db.contact.updateMany(owned),
      db.candidate.updateMany(owned),
      db.job.updateMany(owned),
      db.application.updateMany(owned),
      db.talentPool.updateMany(owned),
      db.distributionList.updateMany(owned),
      db.placement.updateMany(owned),
      db.phone.updateMany(owned),
      db.activity.updateMany({ where: { organisationId, userId: id }, data: { userId: heirId } }),
      db.calendarEvent.updateMany({ where: { organisationId, userId: id }, data: { userId: heirId } }),
      db.phoneCall.updateMany({ where: { organisationId, userId: id }, data: { userId: heirId } }),
      db.phoneImport.updateMany({ where: { organisationId, userId: id }, data: { userId: heirId } }),
      db.task.updateMany({ where: { organisationId, createdById: id }, data: { createdById: heirId } }),
      db.task.updateMany({ where: { organisationId, assignedToId: id }, data: { assignedToId: heirId } }),
      db.teamMember.deleteMany({ where: { userId: id } }),
      db.user.deleteMany({ where: { id, organisationId } }),
    ]);
  }

  /** Taking away sign-in without deleting: the account stays in the list as DEACTIVATED. */
  deactivate(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).user.update({
      where: { id },
      data: { status: 'DEACTIVATED' },
      select: USER_SELECT,
    });
  }
}
