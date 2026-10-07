import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateTeamDto } from '../dto/create-team.dto';
import type { ListTeamsQueryDto } from '../dto/list-teams-query.dto';
import type { UpdateTeamDto } from '../dto/update-team.dto';

const MEMBER_INCLUDE = {
  members: {
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, status: true } } },
    orderBy: { joinedAt: 'asc' as const },
  },
};

/**
 * Tenant-scoped data access for 'teams'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class TeamsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListTeamsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.team.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { name: 'asc' },
        include: MEMBER_INCLUDE,
      }),
      db.team.count({ where }),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).team.findFirst({
      where: { id },
      include: MEMBER_INCLUDE,
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .team.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, dto: CreateTeamDto) {
    return this.db.forTenant(organisationId).team.create({
      data: { ...dto, organisationId },
      include: MEMBER_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdateTeamDto) {
    return this.db.forTenant(organisationId).team.update({
      where: { id },
      data: dto,
      include: MEMBER_INCLUDE,
    });
  }

  remove(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).team.delete({ where: { id } });
  }

  // TeamMember has no organisationId column of its own (see
  // packages/database's TENANT_SCOPED_MODELS) — scopedPrisma passes it
  // through unmodified, so tenancy here is enforced by the service always
  // resolving `teamId` via `findById(organisationId, teamId)` first.
  findMembership(organisationId: string, teamId: string, userId: string) {
    return this.db
      .forTenant(organisationId)
      .teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  }

  addMember(organisationId: string, teamId: string, userId: string, role: 'LEAD' | 'MEMBER' = 'MEMBER') {
    return this.db.forTenant(organisationId).teamMember.create({
      data: { teamId, userId, role },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, status: true } } },
    });
  }

  updateMemberRole(organisationId: string, teamId: string, userId: string, role: 'LEAD' | 'MEMBER') {
    return this.db.forTenant(organisationId).teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
    });
  }

  removeMember(organisationId: string, teamId: string, userId: string) {
    return this.db
      .forTenant(organisationId)
      .teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  }
}
