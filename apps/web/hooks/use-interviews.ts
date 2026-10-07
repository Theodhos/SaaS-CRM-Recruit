import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getInterviewCapabilities,
  listInterviews,
  resendInterviewInvite,
  scheduleInterview,
  type InterviewFilter,
  type ScheduleInterviewInput,
} from '@/services/interviews.service';

const key = {
  capabilities: ['interviews', 'capabilities'] as const,
  list: (applicationId: string) => ['interviews', 'list', applicationId] as const,
  filtered: (filter: InterviewFilter) => ['interviews', 'list', filter] as const,
};

/** Interviews of a candidate (all their applications) or of a job — the detail pages. */
export function useInterviewsFor(filter: InterviewFilter) {
  return useQuery({
    queryKey: key.filtered(filter),
    queryFn: () => listInterviews(filter),
    enabled: Boolean(filter.applicationId || filter.candidateId || filter.jobId),
  });
}

export function useInterviewCapabilities() {
  return useQuery({ queryKey: key.capabilities, queryFn: getInterviewCapabilities, staleTime: 5 * 60_000 });
}

export function useInterviews(applicationId: string | undefined) {
  return useQuery({
    queryKey: key.list(applicationId ?? ''),
    queryFn: () => listInterviews(applicationId!),
    enabled: Boolean(applicationId),
  });
}

export function useScheduleInterview(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleInterviewInput) => scheduleInterview(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key.list(applicationId) });
      void queryClient.invalidateQueries({ queryKey: ['interviews'] }); // the candidate / job listings too
      void queryClient.invalidateQueries({ queryKey: ['calendar'] }); // the slot lands on the calendar too
    },
  });
}

export function useResendInterviewInvite(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resendInterviewInvite(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key.list(applicationId) });
      void queryClient.invalidateQueries({ queryKey: ['interviews'] });
    },
  });
}
