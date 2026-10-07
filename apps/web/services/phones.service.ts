import { apiClient, apiUpload } from '@/lib/api-client';

export type PhoneCallStatus = 'INITIATED' | 'RINGING' | 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'REJECTED' | 'ENDED';
export type CallFilter = 'ALL' | 'NEVER_CALLED' | 'CALLED' | 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED';

export interface Phone {
  id: string;
  name: string | null;
  phone: string;
  normalizedPhone: string;
  email: string | null;
  company: string | null;
  source: string | null;
  status: 'READY' | 'DO_NOT_CALL';
  lastCallAt: string | null;
  lastCallStatus: PhoneCallStatus | null;
  callCount: number;
  candidateId: string | null;
  contactId: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneCall {
  id: string;
  phoneId: string;
  userId: string;
  provider: string;
  providerCallId: string | null;
  direction: 'OUTBOUND' | 'INBOUND';
  status: PhoneCallStatus;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string } | null;
}

export type PhoneDetail = Phone & {
  calls: PhoneCall[];
  candidate: { id: string; firstName: string; lastName: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  companyRef: { id: string; name: string } | null;
};

export interface PhonesPage {
  items: Phone[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PhoneCapabilities {
  calling: boolean;
  provider: 'twilio' | null;
  missing: string[];
  countries: { code: string; name: string; dial: string }[];
}

export interface ImportPreviewRow {
  row: number;
  name: string | null;
  phone: string;
  normalized: string | null;
  email: string | null;
  company: string | null;
  status: 'valid' | 'invalid' | 'duplicate' | 'duplicate_in_file';
  statusLabel: string;
  reason: string | null;
}

export interface ImportPreview {
  importId: string;
  fileName: string;
  defaultCountry: string;
  columns: { phone: string; name: string | null; email: string | null; company: string | null };
  totals: { total: number; valid: number; duplicates: number; invalid: number };
  sample: ImportPreviewRow[];
}

export interface PhoneImport {
  id: string;
  fileName: string;
  status: 'PREVIEW' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  finishedAt: string | null;
}

export interface StartCallResult {
  call: PhoneCall;
  token: string;
  to: string;
  identity: string;
}

export interface UpdateCallInput {
  status?: 'RINGING' | 'ANSWERED' | 'ENDED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'REJECTED';
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  notes?: string;
}

export interface ListPhonesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  callFilter?: CallFilter;
  /** Numbers linked to a candidate / company (their detail pages). */
  candidateId?: string;
  companyId?: string;
}

export function listPhones(params: ListPhonesParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.callFilter && params.callFilter !== 'ALL') query.set('callFilter', params.callFilter);
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.companyId) query.set('companyId', params.companyId);
  return apiClient<PhonesPage>(`/phones?${query.toString()}`);
}

export const getPhone = (id: string) => apiClient<PhoneDetail>(`/phones/${id}`);
export const getPhoneCapabilities = () => apiClient<PhoneCapabilities>('/phones/capabilities');

export function previewPhoneImport(file: File, defaultCountry: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('defaultCountry', defaultCountry);
  return apiUpload<ImportPreview>('/phones/imports/preview', formData);
}

export const confirmPhoneImport = (importId: string) => apiClient<PhoneImport>(`/phones/imports/${importId}/confirm`, { method: 'POST' });
export const getPhoneImport = (importId: string) => apiClient<PhoneImport>(`/phones/imports/${importId}`);
export const getPhoneImportErrors = (importId: string) => apiClient<{ fileName: string; count: number; csv: string }>(`/phones/imports/${importId}/errors`);
export const deletePhone = (id: string) => apiClient<void>(`/phones/${id}`, { method: 'DELETE' });
export const startPhoneCall = (phoneId: string) => apiClient<StartCallResult>(`/phones/${phoneId}/calls`, { method: 'POST' });
export const updatePhoneCall = (callId: string, input: UpdateCallInput) => apiClient<PhoneCall>(`/phones/calls/${callId}`, { method: 'PATCH', body: input });
