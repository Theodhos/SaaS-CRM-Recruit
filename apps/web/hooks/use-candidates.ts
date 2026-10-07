import type { CreateCandidateInput, UpdateCandidateInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCandidate,
  deleteCandidate,
  getCandidate,
  listCandidates,
  updateCandidate,
  type ListCandidatesParams,
} from '@/services/candidates.service';

const key = {
  all: ['candidates'] as const,
  list: (params: ListCandidatesParams) => ['candidates', 'list', params] as const,
  detail: (id: string) => ['candidates', 'detail', id] as const,
};

/** Reference implementation of the hooks/* pattern: TanStack Query wrapping a services/* function, with a stable query key. */
export function useCandidates(params: ListCandidatesParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listCandidates(params) });
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getCandidate(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCandidateInput) => createCandidate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCandidateInput }) =>
      updateCandidate(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
