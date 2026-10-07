import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { UsersService } from '../../users/service/users.service';
import type { AddTeamMemberDto, UpdateTeamMemberDto } from '../dto/add-team-member.dto';
import type { CreateTeamDto } from '../dto/create-team.dto';
import type { ListTeamsQueryDto } from '../dto/list-teams-query.dto';
import type { UpdateTeamDto } from '../dto/update-team.dto';
import { TeamsRepository } from '../repositories/teams.repository';

@Injectable()
export class TeamsService {
  constructor(
    private readonly repository: TeamsRepository,
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organisationId: string, query: ListTeamsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const team = await this.repository.findById(organisationId, id);
    if (!team) throw new ResourceNotFoundException('Team', id);
    return team;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Team', id);
    }
  }

  async create(organisationId: string, userId: string, dto: CreateTeamDto) {
    const team = await this.repository.create(organisationId, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_TEAM',
      entityType: 'Team',
      entityId: team.id,
      newValues: dto,
    });
    return team;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateTeamDto) {
    const existing = await this.getById(organisationId, id);
    const team = await this.repository.update(organisationId, id, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_TEAM',
      entityType: 'Team',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return team;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.remove(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_TEAM',
      entityType: 'Team',
      entityId: id,
    });
  }

  async addMember(organisationId: string, userId: string, teamId: string, dto: AddTeamMemberDto) {
    await this.assertExists(organisationId, teamId);
    // Confirms the user belongs to this organisation the same way every
    // other cross-entity FK gets validated — getById already throws
    // ResourceNotFoundException if it doesn't.
    await this.usersService.getById(organisationId, dto.userId);

    const existing = await this.repository.findMembership(organisationId, teamId, dto.userId);
    if (existing) {
      throw new AppException(
        'ALREADY_TEAM_MEMBER',
        'This user is already a member of this team',
        HttpStatus.CONFLICT,
      );
    }

    const member = await this.repository.addMember(organisationId, teamId, dto.userId, dto.role);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'ADD_TEAM_MEMBER',
      entityType: 'Team',
      entityId: teamId,
      newValues: { userId: dto.userId, role: dto.role ?? 'MEMBER' },
    });
    return member;
  }

  async updateMemberRole(
    organisationId: string,
    userId: string,
    teamId: string,
    memberUserId: string,
    dto: UpdateTeamMemberDto,
  ) {
    await this.assertExists(organisationId, teamId);
    const existing = await this.repository.findMembership(organisationId, teamId, memberUserId);
    if (!existing) throw new ResourceNotFoundException('TeamMember', memberUserId);

    const member = await this.repository.updateMemberRole(organisationId, teamId, memberUserId, dto.role);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_TEAM_MEMBER',
      entityType: 'Team',
      entityId: teamId,
      newValues: { userId: memberUserId, role: dto.role },
    });
    return member;
  }

  async removeMember(organisationId: string, userId: string, teamId: string, memberUserId: string) {
    await this.assertExists(organisationId, teamId);
    const existing = await this.repository.findMembership(organisationId, teamId, memberUserId);
    if (!existing) throw new ResourceNotFoundException('TeamMember', memberUserId);

    await this.repository.removeMember(organisationId, teamId, memberUserId);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'REMOVE_TEAM_MEMBER',
      entityType: 'Team',
      entityId: teamId,
      oldValues: { userId: memberUserId },
    });
  }
}
