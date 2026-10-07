import type { CreateCompanyInput, UpdateCompanyInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCompany,
  deleteCompany,
  getCompany,
  listAllCompanies,
  listCompanies,
  saveCompanyPipelineRecord,
  updateCompany,
  type ListCompaniesParams,
  type SaveCompanyPipelineRecordInput,
} from '@/services/companies.service';

const key = {
  all: ['companies'] as const,
  list: (params: ListCompaniesParams) => ['companies', 'list', params] as const,
  detail: (id: string) => ['companies', 'detail', id] as const,
  board: (search: string, ownerId: string) => ['companies', 'board', search, ownerId] as const,
};

export function useCompanies(params: ListCompaniesParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listCompanies(params), enabled: options.enabled ?? true });
}

export function useCompanyBoard(search?: string, ownerId?: string) {
  return useQuery({ queryKey: key.board(search ?? '', ownerId ?? ''), queryFn: () => listAllCompanies(search, ownerId) });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getCompany(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) => createCompany(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCompanyInput }) =>
      updateCompany(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useSaveCompanyPipelineRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveCompanyPipelineRecordInput }) => saveCompanyPipelineRecord(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
