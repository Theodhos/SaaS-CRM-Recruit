import type { CreateUserInput, UpdateUserInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createUser,
  deactivateUser,
  deleteUser,
  getUser,
  getUsersWorkload,
  listActiveUsers,
  listUsers,
  updateUser,
  type ListUsersParams,
} from '@/services/users.service';

const key = {
  all: ['users'] as const,
  active: ['users', 'active'] as const,
  list: (params: ListUsersParams) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  workload: ['users', 'workload'] as const,
};

export function useActiveUsers() {
  return useQuery({ queryKey: key.active, queryFn: listActiveUsers });
}

export function useUsers(params: ListUsersParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listUsers(params), enabled: options.enabled ?? true });
}

export function useUsersWorkload(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key.workload, queryFn: getUsersWorkload, enabled: options.enabled ?? true });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getUser(id!),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    // what they added now belongs to the admin: every list may have changed
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
