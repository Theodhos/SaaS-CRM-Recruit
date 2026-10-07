import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

/**
 * Auth is the one deliberate exception to "always use forTenant()": login
 * happens BEFORE a tenant is known (a user is looked up by email, which is
 * only unique per-organisation — see schema.prisma's User @@unique), and
 * registration CREATES the organisation. Both operations therefore go
 * through the raw client (`this.db.client`), never scopedPrisma().
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly db: DatabaseService) {}

  // Only role + permission keys are ever read from these results (see
  // toAuthenticatedUser / AuthService.issueTokens), so the organisation row
  // and the other permission columns are not fetched.
  private readonly userInclude = {
    role: {
      include: {
        rolePermissions: { include: { permission: { select: { key: true } } } },
      },
    },
  } as const;

  /** Email is unique per-organisation, not globally — this can return more than one row. */
  findUsersByEmail(email: string) {
    return this.db.client.user.findMany({
      where: { email },
      include: this.userInclude,
    });
  }

  findUserById(id: string) {
    return this.db.client.user.findUnique({
      where: { id },
      include: this.userInclude,
    });
  }

  /** The signed-in user's own account: their name, or their password hash. */
  updateUser(id: string, data: { firstName?: string; lastName?: string; passwordHash?: string }) {
    return this.db.client.user.update({ where: { id }, data, include: this.userInclude });
  }

  findOrganisationBySlug(slug: string) {
    return this.db.client.organisation.findUnique({ where: { slug } });
  }

  findAllPermissions() {
    return this.db.client.permission.findMany();
  }

  /**
   * Self-service tenant signup: creates the Organisation, a default "Admin"
   * Role granted the full current permission catalog, and the first User —
   * atomically, so a failure partway through never leaves an org with no
   * usable login. Mirrors packages/database/prisma/seed/dev-fixtures.ts.
   */
  async createOrganisationWithAdmin(input: {
    organisationName: string;
    slug: string;
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
  }) {
    const permissions = await this.findAllPermissions();

    return this.db.client.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({
        data: { name: input.organisationName, slug: input.slug, status: 'ACTIVE' },
      });

      const role = await tx.role.create({
        data: {
          organisationId: organisation.id,
          name: 'Admin',
          description: 'Full access to all organisation data and settings',
          // createMany: one INSERT for every permission row instead of one per row inside this interactive transaction.
          rolePermissions: { createMany: { data: permissions.map((p) => ({ permissionId: p.id })) } },
        },
      });

      const user = await tx.user.create({
        data: {
          organisationId: organisation.id,
          roleId: role.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: 'ACTIVE',
        },
        include: this.userInclude,
      });

      return { organisation, user };
    });
  }
}
