import type { OffsetPaginatedResult, Team, TeamMember } from '@crm/types';
import type { AddTeamMemberInput, CreateTeamInput, UpdateTeamInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListTeamsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function listTeams(params: ListTeamsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);

  return apiClient<OffsetPaginatedResult<Team>>(`/teams?${query.toString()}`);
}

export function getTeam(id: string) {
  return apiClient<Team>(`/teams/${id}`);
}

export function createTeam(input: CreateTeamInput) {
  return apiClient<Team>('/teams', { method: 'POST', body: input });
}

export function updateTeam(id: string, input: UpdateTeamInput) {
  return apiClient<Team>(`/teams/${id}`, { method: 'PATCH', body: input });
}

export function deleteTeam(id: string) {
  return apiClient<void>(`/teams/${id}`, { method: 'DELETE' });
}

export function addTeamMember(teamId: string, input: AddTeamMemberInput) {
  return apiClient<TeamMember>(`/teams/${teamId}/members`, { method: 'POST', body: input });
}

export function removeTeamMember(teamId: string, userId: string) {
  return apiClient<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}
