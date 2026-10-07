import type { OffsetPaginatedResult, User, UserSummary } from '@crm/types';
import type { CreateUserInput, UpdateUserInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  roleId?: string;
}

export function listActiveUsers() {
  return apiClient<UserSummary[]>('/users/active');
}

export function listUsers(params: ListUsersParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.roleId) query.set('roleId', params.roleId);

  return apiClient<OffsetPaginatedResult<User>>(`/users?${query.toString()}`);
}

/** What a user has built in their own account: live candidates, companies, jobs, and active placements of their candidates. */
export interface UserWorkload {
  userId: string;
  candidates: number;
  companies: number;
  jobs: number;
  activeEmployees: number;
}

export function getUsersWorkload() {
  return apiClient<UserWorkload[]>('/users/workload');
}

export function getUser(id: string) {
  return apiClient<User>(`/users/${id}`);
}

export function createUser(input: CreateUserInput) {
  return apiClient<{ user: User; temporaryPassword: string | null }>('/users', {
    method: 'POST',
    body: input,
  });
}

export function updateUser(id: string, input: UpdateUserInput) {
  return apiClient<User>(`/users/${id}`, { method: 'PATCH', body: input });
}

/** Deletes the account for good; what the user added passes to the admin who deletes them. */
export function deleteUser(id: string) {
  return apiClient<void>(`/users/${id}/permanent`, { method: 'DELETE' });
}

export function deactivateUser(id: string) {
  return apiClient<void>(`/users/${id}`, { method: 'DELETE' });
}
