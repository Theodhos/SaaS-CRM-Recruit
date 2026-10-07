import type { Document, OffsetPaginatedResult } from '@crm/types';

import { apiClient, apiUpload } from '@/lib/api-client';

export interface ListDocumentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  companyId?: string;
  contactId?: string;
  jobId?: string;
  applicationId?: string;
  candidateId?: string;
  placementId?: string;
}

export type DocumentWithRelations = Document & {
  downloadUrl: string;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  job: { id: string; title: string } | null;
  candidate: { id: string; firstName: string; lastName: string } | null;
  placement: { id: string; status: string } | null;
  uploadedBy: { id: string; firstName: string; lastName: string } | null;
};

export interface UploadDocumentInput {
  file: File;
  name?: string;
  type?: string;
  companyId?: string;
  contactId?: string;
  jobId?: string;
  applicationId?: string;
  candidateId?: string;
  placementId?: string;
}

export function listDocuments(params: ListDocumentsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.type) query.set('type', params.type);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.contactId) query.set('contactId', params.contactId);
  if (params.jobId) query.set('jobId', params.jobId);
  if (params.applicationId) query.set('applicationId', params.applicationId);
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.placementId) query.set('placementId', params.placementId);

  return apiClient<OffsetPaginatedResult<DocumentWithRelations>>(`/documents?${query.toString()}`);
}

export function uploadDocument(input: UploadDocumentInput) {
  const formData = new FormData();
  formData.append('file', input.file);
  if (input.name) formData.append('name', input.name);
  if (input.type) formData.append('type', input.type);
  if (input.companyId) formData.append('companyId', input.companyId);
  if (input.contactId) formData.append('contactId', input.contactId);
  if (input.jobId) formData.append('jobId', input.jobId);
  if (input.applicationId) formData.append('applicationId', input.applicationId);
  if (input.candidateId) formData.append('candidateId', input.candidateId);
  if (input.placementId) formData.append('placementId', input.placementId);

  return apiUpload<DocumentWithRelations>('/documents', formData);
}

export function deleteDocument(id: string) {
  return apiClient<void>(`/documents/${id}`, { method: 'DELETE' });
}

/** The CV editor's result, saved as a new document beside the original (same type and links). The original is untouched. */
export function saveEditedDocument(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<DocumentWithRelations>(`/documents/${id}/edited`, formData);
}
