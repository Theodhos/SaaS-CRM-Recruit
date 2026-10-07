import { apiClient } from '@/lib/api-client';

export interface DashboardSummary {
  candidateCount: number;
  openJobCount: number;
  activeApplicationCount: number;
  placementCount: number;
  /** Active accounts working on the platform right now (organisation-wide). */
  activeUserCount: number;
  adminCount: number;
  activeEmployeeCount: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface PipelineStageBreakdown extends StatusBreakdown {
  isTerminal: boolean;
}

export interface AnalyticsOverview {
  summary: DashboardSummary;
  candidatesByStatus: StatusBreakdown[];
  jobsByStatus: StatusBreakdown[];
  companiesByStatus: StatusBreakdown[];
  placementsByStatus: StatusBreakdown[];
  documentsByType: StatusBreakdown[];
  placementsByMonth: { month: string; count: number }[];
  topCompaniesByJobs: { name: string; jobCount: number }[];
  candidatesByOwner: { owner: string; count: number }[];
  applicationsByPipelineStage: PipelineStageBreakdown[];
  unassignedCandidateCount: number;
}

export function getAnalyticsOverview() {
  return apiClient<AnalyticsOverview>('/analytics/overview');
}
