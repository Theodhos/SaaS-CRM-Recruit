import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createFee, deleteFee, getFeesOverview, listFees, updateFee, type FeeInput, type ListFeesParams } from '@/services/fees.service';

const key = {
  all: ['fees'] as const,
  list: (params: ListFeesParams) => ['fees', 'list', params] as const,
  overview: ['fees', 'overview'] as const,
};

export function useFees(params: ListFeesParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listFees(params) });
}

export function useFeesOverview() {
  return useQuery({ queryKey: key.overview, queryFn: getFeesOverview });
}

export function useCreateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeInput) => createFee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<FeeInput> }) => updateFee(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFee(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
