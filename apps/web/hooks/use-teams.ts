import type { AddTeamMemberInput, CreateTeamInput, UpdateTeamInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeam,
  listTeams,
  removeTeamMember,
  updateTeam,
  type ListTeamsParams,
} from '@/services/teams.service';

const key = {
  all: ['teams'] as const,
  list: (params: ListTeamsParams) => ['teams', 'list', params] as const,
  detail: (id: string) => ['teams', 'detail', id] as const,
};

export function useTeams(params: ListTeamsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listTeams(params) });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getTeam(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeamInput) => createTeam(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTeamInput }) => updateTeam(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, input }: { teamId: string; input: AddTeamMemberInput }) =>
      addTeamMember(teamId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      removeTeamMember(teamId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
