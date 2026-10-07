import { randomBytes } from 'crypto';

import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { RolesService } from '../../roles/service/roles.service';
import type { CreateUserDto } from '../dto/create-user.dto';
import type { ListUsersQueryDto } from '../dto/list-users-query.dto';
import type { UpdateUserDto } from '../dto/update-user.dto';
import { UsersRepository } from '../repositories/users.repository';

/** The owner, and the one admin that may be created next to them. */
const MAX_ADMINS = 2;

function generateTemporaryPassword(): string {
  // 12 random bytes as base64url — readable enough to hand to someone over
  // Slack/in person, long/random enough not to need a strength check.
  return randomBytes(12).toString('base64url');
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly rolesService: RolesService,
    private readonly configService: ConfigService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  listActiveMembers(organisationId: string) {
    return this.repository.findActiveOrgMembers(organisationId);
  }

  /** Ids of the organisation's active admins (see UsersRepository.findAdminIds). */
  async adminIds(organisationId: string): Promise<string[]> {
    return (await this.repository.findAdminIds(organisationId)).map((user) => user.id);
  }

  async list(organisationId: string, query: ListUsersQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  workload(organisationId: string) {
    return this.repository.workload(organisationId);
  }

  async getById(organisationId: string, id: string) {
    const user = await this.repository.findById(organisationId, id);
    if (!user) throw new ResourceNotFoundException('User', id);
    return user;
  }

  /**
   * Returns `temporaryPassword` in the plaintext response — the one and
   * only time it's ever available, since only the hash is persisted. No
   * outbound email is wired up yet (see EmailService), so the recruiter/
   * admin creating the account is expected to relay it to the new hire
   * directly; a real invite-email flow can swap this out later without
   * changing the endpoint's shape.
   */
  /**
   * One admin may be created next to the organisation's owner — no more. `exceptUserId`: the account being edited,
   * which does not count against itself.
   */
  private async assertAdminSeat(organisationId: string, roleId: string, exceptUserId?: string): Promise<void> {
    if (!(await this.repository.isAdminRole(organisationId, roleId))) return;
    const admins = (await this.repository.findAdmins(organisationId)).filter((admin) => admin.id !== exceptUserId);
    if (admins.length >= MAX_ADMINS) {
      throw new AppException('ADMIN_LIMIT', 'Only one admin can be created next to the owner. Delete the other admin first.', HttpStatus.CONFLICT);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateUserDto) {
    await this.rolesService.assertExists(organisationId, dto.roleId);
    await this.assertAdminSeat(organisationId, dto.roleId);

    const existing = await this.repository.findByEmail(organisationId, dto.email);
    if (existing) {
      throw new AppException(
        'DUPLICATE_EMAIL',
        `A user with email "${dto.email}" already exists in this organisation`,
        HttpStatus.CONFLICT,
      );
    }

    // An admin can set the initial password directly (dto.password); left
    // blank, one is generated and handed back once so it can be shared —
    // either way the account is ACTIVE unless another status is chosen, so they can sign in at once.
    const generatedPassword = dto.password ? null : generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(
      dto.password ?? generatedPassword!,
      // See auth.service.ts's register() for why this can't be `get<number>` directly.
      Number(this.configService.get('PASSWORD_SALT_ROUNDS', 12)),
    );

    const user = await this.repository.create(organisationId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      roleId: dto.roleId,
      status: dto.status ?? 'ACTIVE',
      passwordHash,
      allowedSections: dto.allowedSections ?? [],
      loginOtpEnabled: dto.loginOtpEnabled ?? false,
    });

    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      newValues: { firstName: user.firstName, lastName: user.lastName, email: user.email, roleId: user.roleId },
    });

    return { user, temporaryPassword: generatedPassword };
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.getById(organisationId, id);
    if (dto.roleId) {
      await this.rolesService.assertExists(organisationId, dto.roleId);
      if (dto.roleId !== existing.roleId) await this.assertAdminSeat(organisationId, dto.roleId, id);
    }

    // `password` never reaches the repository/DB as-is (there is no such
    // column — only `passwordHash`) — an admin resetting someone's password
    // from the edit form hashes here, same as create().
    const { password, ...rest } = dto;
    const passwordHash = password
      ? await bcrypt.hash(password, Number(this.configService.get('PASSWORD_SALT_ROUNDS', 12)))
      : undefined;

    const user = await this.repository.update(organisationId, id, { ...rest, ...(passwordHash ? { passwordHash } : {}) });
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: id,
      oldValues: existing,
      // never the password itself — the log only says that it was changed
      newValues: { ...rest, ...(password ? { passwordChanged: true } : {}) },
    });
    return user;
  }

  /**
   * Deletes an instructor or a created admin for good. Not oneself, and not the organisation's owner (its first
   * admin). What they added passes to the admin who deletes them (see UsersRepository.deletePermanently).
   */
  async removePermanently(organisationId: string, userId: string, id: string) {
    const target = await this.getById(organisationId, id);
    if (id === userId) {
      throw new AppException('CANNOT_DELETE_SELF', 'You cannot delete your own account.', HttpStatus.BAD_REQUEST);
    }
    const owner = (await this.repository.findAdmins(organisationId))[0];
    if (owner?.id === id) {
      throw new AppException('CANNOT_DELETE_OWNER', "The organisation's owner cannot be deleted.", HttpStatus.BAD_REQUEST);
    }
    await this.repository.deletePermanently(organisationId, id, userId);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_USER',
      entityType: 'User',
      entityId: id,
      oldValues: { firstName: target.firstName, lastName: target.lastName, email: target.email, role: target.role.name },
    });
  }

  async deactivate(organisationId: string, userId: string, id: string) {
    await this.getById(organisationId, id);
    const user = await this.repository.deactivate(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DEACTIVATE_USER',
      entityType: 'User',
      entityId: id,
    });
    return user;
  }
}
