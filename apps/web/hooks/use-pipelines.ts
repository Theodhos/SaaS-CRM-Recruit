import type {
  CreateChecklistItemInput,
  CreatePipelineInput,
  CreatePipelineStageInput,
  UpdateChecklistItemInput,
  UpdatePipelineInput,
  UpdatePipelineStageInput,
} from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createChecklistItem,
  createPipeline,
  createPipelineStage,
  deleteChecklistItem,
  deletePipeline,
  deletePipelineStage,
  getPipeline,
  listPipelines,
  updateChecklistItem,
  updatePipeline,
  updatePipelineStage,
} from '@/services/pipelines.service';

const key = {
  all: ['pipelines'] as const,
  list: ['pipelines', 'list'] as const,
  detail: (id: string) => ['pipelines', 'detail', id] as const,
};

export function usePipelines() {
  return useQuery({ queryKey: key.list, queryFn: listPipelines });
}

export function usePipeline(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getPipeline(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePipelineInput) => createPipeline(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePipelineInput }) => updatePipeline(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeletePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePipeline(id),
    // the pipeline's applications go with it, and the candidates' status is derived from their applications
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key.all }),
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['candidates'] }),
      ]),
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePipelineStageInput) => createPipelineStage(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePipelineStageInput }) =>
      updatePipelineStage(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePipelineStage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, input }: { stageId: string; input: CreateChecklistItemInput }) =>
      createChecklistItem(stageId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChecklistItemInput }) =>
      updateChecklistItem(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
