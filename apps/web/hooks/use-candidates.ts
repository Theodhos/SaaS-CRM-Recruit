import { useQuery } from '@tanstack/react-query';

import { listCandidates } from '@/services/candidates.service';

/**
 * Reference implementation of the hooks/* pattern: TanStack Query wrapping a
 * services/* function, with a stable query key. Add sibling hooks alongside
 * each feature's Phase 2 implementation.
 */
export function useCandidates(params: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: () => listCandidates(params),
  });
}
