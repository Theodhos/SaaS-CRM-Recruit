import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmPhoneImport,
  deletePhone,
  getPhone,
  getPhoneCapabilities,
  getPhoneImport,
  listPhones,
  startPhoneCall,
  updatePhoneCall,
  type ListPhonesParams,
  type UpdateCallInput,
} from '@/services/phones.service';

const key = {
  all: ['phones'] as const,
  list: (params: ListPhonesParams) => ['phones', 'list', params] as const,
  detail: (id: string) => ['phones', 'detail', id] as const,
  capabilities: ['phones', 'capabilities'] as const,
  import: (id: string) => ['phones', 'import', id] as const,
};

export function usePhones(params: ListPhonesParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listPhones(params) });
}

export function usePhone(id: string | undefined) {
  return useQuery({ queryKey: key.detail(id ?? ''), queryFn: () => getPhone(id!), enabled: Boolean(id) });
}

export function usePhoneCapabilities() {
  return useQuery({ queryKey: key.capabilities, queryFn: getPhoneCapabilities, staleTime: 5 * 60_000 });
}

/** Polls while the import is running so the dialog can show progress. */
export function usePhoneImport(id: string | undefined) {
  return useQuery({
    queryKey: key.import(id ?? ''),
    queryFn: () => getPhoneImport(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' || query.state.data?.status === 'PREVIEW' ? 1000 : false),
  });
}

export function useConfirmPhoneImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (importId: string) => confirmPhoneImport(importId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeletePhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePhone(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useStartPhoneCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phoneId: string) => startPhoneCall(phoneId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdatePhoneCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, input }: { callId: string; input: UpdateCallInput }) => updatePhoneCall(callId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
