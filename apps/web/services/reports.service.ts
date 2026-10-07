import { apiClient } from '@/lib/api-client';

import type { StatusBreakdown } from './analytics.service';

export interface ConversionRow {
  key: string;
  applications: number;
  placements: number;
  conversionRate: number;
}

export interface OwnerPerformanceRow {
  owner: string;
  candidates: number;
  applications: number;
  placements: number;
  conversionRate: number;
}

export interface CompanyPerformanceRow {
  company: string;
  jobs: number;
  applications: number;
  placements: number;
  conversionRate: number;
}

export interface JobPerformanceRow {
  job: string;
  company: string;
  applications: number;
  placements: number;
  conversionRate: number;
}

export interface ReportsOverview {
  outcomeSummary: StatusBreakdown[];
  sourceEffectiveness: ConversionRow[];
  ownerPerformance: OwnerPerformanceRow[];
  companyPerformance: CompanyPerformanceRow[];
  jobPerformance: JobPerformanceRow[];
  applicationsByMonth: { month: string; count: number }[];
}

export function getReportsOverview() {
  return apiClient<ReportsOverview>('/reports/overview');
}
