import { apiClient } from '@/lib/api-client';

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: string;
  /** minutes */
  duration: number;
  location: string | null;
  meetingUrl: string | null;
  /** Zoom's host link — only the interviewer sees it. */
  hostUrl: string | null;
  provider: 'zoom' | 'manual' | null;
  timezone: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  notes: string | null;
  inviteSentAt: string | null;
  inviteSentTo: string | null;
  interviewer: { id: string; firstName: string; lastName: string; email: string } | null;
  /** Present on candidate / job listings. */
  application?: { id: string; candidate: { id: string; firstName: string; lastName: string }; job: { id: string; title: string } };
  createdAt: string;
  updatedAt: string;
}

export interface InterviewFilter {
  applicationId?: string;
  candidateId?: string;
  jobId?: string;
}

export interface InterviewCapabilities {
  /** Zoom links are created automatically (Server-to-Server OAuth configured on the API). */
  zoomConfigured: boolean;
  /** Invitations actually leave the platform (SMTP configured on the API). */
  emailConfigured: boolean;
}

export interface ScheduleInterviewInput {
  applicationId: string;
  scheduledAt: string;
  durationMinutes: number;
  timezone?: string;
  meetingUrl?: string;
  notes?: string;
  sendInvite?: boolean;
}

export interface InviteDelivery {
  sent: boolean;
  to: string | null;
  error: string | null;
}

export interface ScheduleInterviewResult {
  interview: Interview;
  email: InviteDelivery;
}

export function getInterviewCapabilities() {
  return apiClient<InterviewCapabilities>('/interviews/capabilities');
}

export function listInterviews(filter: string | InterviewFilter) {
  const params = typeof filter === 'string' ? { applicationId: filter } : filter;
  const query = new URLSearchParams();
  if (params.applicationId) query.set('applicationId', params.applicationId);
  if (params.candidateId) query.set('candidateId', params.candidateId);
  if (params.jobId) query.set('jobId', params.jobId);
  return apiClient<Interview[]>(`/interviews?${query.toString()}`);
}

export function scheduleInterview(input: ScheduleInterviewInput) {
  return apiClient<ScheduleInterviewResult>('/interviews', { method: 'POST', body: input });
}

export function resendInterviewInvite(id: string) {
  return apiClient<ScheduleInterviewResult>(`/interviews/${id}/send-invite`, { method: 'POST' });
}
