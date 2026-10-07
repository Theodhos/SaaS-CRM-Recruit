import type { PipelineStageType } from '../common';

import type { TenantScopedEntity } from './base';

export interface PipelineStageChecklistItem {
  id: string;
  pipelineStageId: string;
  label: string;
  order: number;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  type: PipelineStageType;
  checklistItems: PipelineStageChecklistItem[];
}

export interface Pipeline extends TenantScopedEntity {
  name: string;
  description: string | null;
  /** What a candidate becomes when they reach this scheme's "Placed" stage. */
  employmentType: 'PERMANENT' | 'TEMPORARY';
  stages: PipelineStage[];
}
