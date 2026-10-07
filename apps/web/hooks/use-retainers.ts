import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createRetainer,
  deleteRetainer,
  getRetainersOverview,
  listRetainers,
  renewRetainer,
  updateRetainer,
  type ListRetainersParams,
  type RetainerInput,
} from '@/services/retainers.service';

const key = {
  all: ['retainers'] as const,
  list: (params: ListRetainersParams) => ['retainers', 'list', params] as const,
  overview: ['retainers', 'overview'] as const,
};

export function useRetainers(params: ListRetainersParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listRetainers(params) });
}

export function useRetainersOverview() {
  return useQuery({ queryKey: key.overview, queryFn: getRetainersOverview });
}

export function useCreateRetainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RetainerInput) => createRetainer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateRetainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<RetainerInput> }) => updateRetainer(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useRenewRetainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { months: number; amount?: number } }) => renewRetainer(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteRetainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRetainer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
