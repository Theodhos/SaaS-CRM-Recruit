import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteDocument,
  listDocuments,
  uploadDocument,
  type ListDocumentsParams,
  type UploadDocumentInput,
} from '@/services/documents.service';

const key = {
  all: ['documents'] as const,
  list: (params: ListDocumentsParams) => ['documents', 'list', params] as const,
};

export function useDocuments(params: ListDocumentsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listDocuments(params) });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
