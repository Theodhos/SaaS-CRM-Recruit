import { z } from 'zod';

import { optionalId } from './optional-id';

export const applicationStatusEnum = z.enum(['ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'PLACED']);
export const applicationSourceEnum = z.enum([
  'SOURCED', 'INBOUND', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'CAREER_SITE', 'OTHER',
]);

export const createApplicationSchema = z.object({
  candidateId: z.string().cuid(),
  jobId: z.string().cuid(),
  pipelineId: optionalId,
  pipelineStageId: optionalId,
  status: applicationStatusEnum.optional(),
  source: applicationSourceEnum.optional(),
  ownerId: optionalId,
});

export const updateApplicationSchema = createApplicationSchema.partial();

export const toggleChecklistItemSchema = z.object({
  completed: z.boolean(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ToggleChecklistItemInput = z.infer<typeof toggleChecklistItemSchema>;
