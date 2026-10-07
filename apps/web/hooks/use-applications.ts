import type { CreateApplicationInput, UpdateApplicationInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  toggleChecklistItem,
  updateApplication,
  type ListApplicationsParams,
} from '@/services/applications.service';

const key = {
  all: ['applications'] as const,
  list: (params: ListApplicationsParams) => ['applications', 'list', params] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
};

export function useApplications(params: ListApplicationsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listApplications(params) });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getApplication(id!),
    enabled: Boolean(id),
  });
}

// An Application coming or going changes which Candidates count as
// "unassigned" (see the Candidates page's unassigned-applicants list and the pipeline
// board), so every mutation here also invalidates ['candidates'] — not just
// its own ['applications'] key.
function invalidateApplicationsAndCandidates(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: key.all });
  queryClient.invalidateQueries({ queryKey: ['candidates'] });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApplicationInput) => createApplication(input),
    onSuccess: () => invalidateApplicationsAndCandidates(queryClient),
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateApplicationInput }) =>
      updateApplication(id, input),
    onSuccess: () => invalidateApplicationsAndCandidates(queryClient),
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => invalidateApplicationsAndCandidates(queryClient),
  });
}

export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      checklistItemId,
      completed,
    }: {
      applicationId: string;
      checklistItemId: string;
      completed: boolean;
    }) => toggleChecklistItem(applicationId, checklistItemId, completed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
