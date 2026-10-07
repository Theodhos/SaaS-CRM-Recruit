import type { CreateJobInput, UpdateJobInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createJob,
  deleteJob,
  getJob,
  listJobs,
  updateJob,
  type ListJobsParams,
} from '@/services/jobs.service';

const key = {
  all: ['jobs'] as const,
  list: (params: ListJobsParams) => ['jobs', 'list', params] as const,
  detail: (id: string) => ['jobs', 'detail', id] as const,
};

export function useJobs(params: ListJobsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listJobs(params) });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getJob(id!),
    enabled: Boolean(id),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => createJob(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJobInput }) => updateJob(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
