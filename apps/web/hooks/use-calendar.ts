import type { CreateCalendarEventInput, UpdateCalendarEventInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  type ListCalendarEventsParams,
} from '@/services/calendar.service';

const key = {
  all: ['calendar'] as const,
  list: (params: ListCalendarEventsParams) => ['calendar', 'list', params] as const,
  detail: (id: string) => ['calendar', 'detail', id] as const,
};

export function useCalendarEvents(params: ListCalendarEventsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listCalendarEvents(params) });
}

export function useCalendarEvent(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getCalendarEvent(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalendarEventInput) => createCalendarEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCalendarEventInput }) =>
      updateCalendarEvent(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
