import { apiClient } from '@/lib/api-client';

export interface StageNote {
  id: string;
  pipelineStageId: string;
  notes: string | null;
  /** The stage's own form — see features/pipelines/stage-forms.ts. */
  fields: Record<string, string | number | boolean | null>;
  hourlyRate: number | null;
  hoursPerDay: number;
  daysPerMonth: number;
  feePercent: number | null;
  currency: string;
  perDay: number | null;
  perMonth: number | null;
  feePerMonth: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StageNotesResponse {
  applicationId: string;
  currentStageId: string;
  /** When the application was made. */
  startedAt: string;
  /** Every move of the card on the board, oldest first. */
  moves: {
    at: string;
    kind: 'added' | 'moved' | 'reopened' | 'removed' | 'restored';
    fromStageId: string | null;
    toStageId: string | null;
    /** Who did it; null when nobody was signed in (a website application). */
    by: string | null;
  }[];
  stages: {
    stage: { id: string; name: string; order: number; type: 'STANDARD' | 'PLACED' | 'REJECTED' };
    note: StageNote | null;
    /** When the applicant (last) entered this stage; null for a stage they have never been in. */
    enteredAt: string | null;
  }[];
}

export interface UpsertStageNoteInput {
  notes?: string;
  fields?: Record<string, string | number | boolean | null>;
  hourlyRate?: number | null;
  hoursPerDay?: number;
  daysPerMonth?: number;
  feePercent?: number | null;
  currency?: string;
}

export function listStageNotes(applicationId: string) {
  return apiClient<StageNotesResponse>(`/applications/${applicationId}/stage-notes`);
}

export function upsertStageNote(applicationId: string, stageId: string, input: UpsertStageNoteInput) {
  return apiClient<StageNote>(`/applications/${applicationId}/stage-notes/${stageId}`, { method: 'PUT', body: input });
}
