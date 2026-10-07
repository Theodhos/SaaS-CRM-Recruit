import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getSession } from '@/services/auth.service';

/**
 * The one source of truth for "who is logged in" on the client. The
 * session cookie itself is httpOnly (set by apps/api — see
 * common/utils/auth-cookies.ts), so the frontend never reads a token
 * directly; it always asks /auth/me. `retry: false` because a 401 here
 * means "not logged in", not a transient failure worth retrying.
 */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
    staleTime: 60_000,
  });
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['session'] });
}
