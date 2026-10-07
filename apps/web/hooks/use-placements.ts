import type { CreatePlacementInput, UpdatePlacementInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createPlacement,
  deletePlacement,
  getPlacement,
  listPlacements,
  updatePlacement,
  type ListPlacementsParams,
} from '@/services/placements.service';

const key = {
  all: ['placements'] as const,
  list: (params: ListPlacementsParams) => ['placements', 'list', params] as const,
  detail: (id: string) => ['placements', 'detail', id] as const,
};

export function usePlacements(params: ListPlacementsParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listPlacements(params), enabled: options.enabled ?? true });
}

export function usePlacement(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getPlacement(id!),
    enabled: Boolean(id),
  });
}

// A Placement's existence also affects Candidate.status ('PLACED') and the
// Application it came from, so both caches get invalidated alongside
// ['placements'] — this page (the "who's actually a Candidate now" view)
// only makes sense if those stay in sync with each other.
function invalidatePlacementRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: key.all });
  queryClient.invalidateQueries({ queryKey: ['candidates'] });
  queryClient.invalidateQueries({ queryKey: ['applications'] });
}

export function useCreatePlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlacementInput) => createPlacement(input),
    onSuccess: () => invalidatePlacementRelated(queryClient),
  });
}

export function useUpdatePlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlacementInput }) => updatePlacement(id, input),
    onSuccess: () => invalidatePlacementRelated(queryClient),
  });
}

export function useDeletePlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlacement(id),
    onSuccess: () => invalidatePlacementRelated(queryClient),
  });
}
