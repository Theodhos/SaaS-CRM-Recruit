import type { CompanyPipelineStage } from '@crm/types';

/** Columns of the Pipeline Companies board, in board order. */
export const COMPANY_PIPELINE_STAGES: { value: CompanyPipelineStage; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_CONVERSATION', label: 'In conversation / Follow-up' },
  { value: 'WIN', label: 'Win' },
  { value: 'LOST', label: 'Lost' },
];
