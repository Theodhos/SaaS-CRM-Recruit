import type { Candidate, OffsetPaginatedResult } from '@crm/types';
import type { CreateCandidateInput, UpdateCandidateInput } from '@crm/validation';

import { apiClient, apiUpload } from '@/lib/api-client';

export interface ParsedResumeFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  currentCompany?: string;
}

export function parseResume(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<ParsedResumeFields>('/candidates/parse-resume', formData);
}

export interface ListCandidatesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  companyId?: string;
  /** Only the candidates this user added. */
  ownerId?: string;
  /** Rank/filter to candidates interested in this specific open Job — puts people competing for the same opening head to head. */
  interestedJobId?: string;
  /** Candidates with no Application yet — the unassigned applicant pool (see /candidates). */
  unassigned?: boolean;
  /** Candidates with at least one Application — the pipeline board's "Applicant" filter (see /pipeline). */
  hasApplications?: boolean;
  /** Where the applicant stands: PENDING (no application yet), ACTIVE (in progress or placed), REJECTED. */
  reviewStatus?: ReviewStatus;
}

/** REAPPLIED = rejected once, live again on another job; SUGGESTED = rejected, and a similar job is open now. */
export type ReviewStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REAPPLIED' | 'SUGGESTED';

export interface SuggestedJob {
  id: string;
  title: string;
  location: string | null;
  company: { id: string; name: string } | null;
  /** The job they were turned down for (or wanted) that this opening resembles. */
  matchedOn: string;
}

export type CandidateWithCompany = Candidate & {
  company: { id: string; name: string } | null;
  interestedJob: { id: string; title: string; location: string | null; company: { id: string; name: string } | null } | null;
  /** Computed from what's on file (experience, reachability, job fit) — see CandidatesService. Present on every list response, most meaningful for the unassigned pool, which is ranked by it. */
  potentialScore: number;
  potentialLabel: 'High' | 'Medium' | 'Low';
  /** Derived from their applications — see the API's candidates.service. */
  reviewStatus: ReviewStatus;
  /** The pipeline stage that status comes from: their live (else latest) application. Null while Pending. */
  currentApplication: { pipelineId: string; jobId: string; jobTitle: string; stage: string; stageType: 'STANDARD' | 'PLACED' | 'REJECTED' } | null;
  /** Only with the SUGGESTED filter: open jobs similar to the one they were rejected for. */
  suggestedJobs?: SuggestedJob[];
};

export type CandidateDetail = CandidateWithCompany & {
  candidateTags?: { tag: { id: string; name: string; color?: string | null } }[];
};

export function listCandidates(params: ListCandidatesParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  if (params.interestedJobId) query.set('interestedJobId', params.interestedJobId);
  if (params.unassigned) query.set('unassigned', 'true');
  if (params.hasApplications) query.set('hasApplications', 'true');
  if (params.reviewStatus) query.set('reviewStatus', params.reviewStatus);

  return apiClient<OffsetPaginatedResult<CandidateWithCompany>>(`/candidates?${query.toString()}`);
}

export function getCandidate(id: string) {
  return apiClient<CandidateDetail>(`/candidates/${id}`);
}

export function createCandidate(input: CreateCandidateInput) {
  return apiClient<Candidate>('/candidates', { method: 'POST', body: input });
}

export function updateCandidate(id: string, input: UpdateCandidateInput) {
  return apiClient<Candidate>(`/candidates/${id}`, { method: 'PATCH', body: input });
}

export function deleteCandidate(id: string) {
  return apiClient<void>(`/candidates/${id}`, { method: 'DELETE' });
}
