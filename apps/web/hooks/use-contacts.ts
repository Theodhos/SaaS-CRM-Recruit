import type { CreateContactInput, UpdateContactInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createContact,
  deleteContact,
  getContact,
  listContacts,
  updateContact,
  type ListContactsParams,
} from '@/services/contacts.service';

const key = {
  all: ['contacts'] as const,
  list: (params: ListContactsParams) => ['contacts', 'list', params] as const,
  detail: (id: string) => ['contacts', 'detail', id] as const,
};

export function useContacts(params: ListContactsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listContacts(params) });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getContact(id!),
    enabled: Boolean(id),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) => createContact(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateContactInput }) =>
      updateContact(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
