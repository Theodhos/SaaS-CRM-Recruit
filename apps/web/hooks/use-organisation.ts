import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getIntegrations, getOrganisation, updateOrganisation } from '@/services/organisation.service';

const key = {
  current: ['organisation'] as const,
  integrations: ['organisation', 'integrations'] as const,
};

/** The organisation and its pay defaults. They change rarely, so they are kept for a while. */
export function useOrganisation() {
  return useQuery({ queryKey: key.current, queryFn: getOrganisation, staleTime: 5 * 60_000 });
}

export function useUpdateOrganisation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateOrganisation>[0]) => updateOrganisation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.current }),
  });
}

export function useIntegrations(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key.integrations, queryFn: getIntegrations, enabled: options.enabled ?? true });
}
