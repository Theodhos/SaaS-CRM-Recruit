import type { Pipeline, PipelineStage, PipelineStageChecklistItem } from '@crm/types';
import type {
  CreateChecklistItemInput,
  CreatePipelineInput,
  CreatePipelineStageInput,
  UpdateChecklistItemInput,
  UpdatePipelineInput,
  UpdatePipelineStageInput,
} from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export function listPipelines() {
  return apiClient<Pipeline[]>('/pipelines');
}

export function getPipeline(id: string) {
  return apiClient<Pipeline>(`/pipelines/${id}`);
}

export function createPipeline(input: CreatePipelineInput) {
  return apiClient<Pipeline>('/pipelines', { method: 'POST', body: input });
}

export function updatePipeline(id: string, input: UpdatePipelineInput) {
  return apiClient<Pipeline>(`/pipelines/${id}`, { method: 'PATCH', body: input });
}

export function deletePipeline(id: string) {
  return apiClient<void>(`/pipelines/${id}`, { method: 'DELETE' });
}

export function createPipelineStage(input: CreatePipelineStageInput) {
  return apiClient<PipelineStage>('/pipeline-stages', { method: 'POST', body: input });
}

export function updatePipelineStage(id: string, input: UpdatePipelineStageInput) {
  return apiClient<PipelineStage>(`/pipeline-stages/${id}`, { method: 'PATCH', body: input });
}

export function deletePipelineStage(id: string) {
  return apiClient<void>(`/pipeline-stages/${id}`, { method: 'DELETE' });
}

export function createChecklistItem(stageId: string, input: CreateChecklistItemInput) {
  return apiClient<PipelineStageChecklistItem>(`/pipeline-stages/${stageId}/checklist-items`, {
    method: 'POST',
    body: input,
  });
}

export function updateChecklistItem(id: string, input: UpdateChecklistItemInput) {
  return apiClient<PipelineStageChecklistItem>(`/pipeline-stages/checklist-items/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteChecklistItem(id: string) {
  return apiClient<void>(`/pipeline-stages/checklist-items/${id}`, { method: 'DELETE' });
}
