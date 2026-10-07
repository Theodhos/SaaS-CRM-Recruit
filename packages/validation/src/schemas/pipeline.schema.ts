import { z } from 'zod';

import { placementEmploymentTypeEnum } from './placement.schema';

export const pipelineStageTypeEnum = z.enum(['STANDARD', 'PLACED', 'REJECTED']);

export const pipelineStageInputSchema = z.object({
  name: z.string().min(1).max(100),
  // Optional/defaulted rather than strictly required: the pipeline builder
  // form recomputes this from each stage's row position right before
  // submit, so a stage the user just added (with no order picked yet)
  // should never fail validation on that account.
  order: z.coerce.number().int().min(1).optional().default(1),
  type: pipelineStageTypeEnum.optional(),
});

export const createPipelineSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  /** What the scheme's placed candidates become on Active Employees. */
  employmentType: placementEmploymentTypeEnum.optional(),
  stages: z.array(pipelineStageInputSchema).min(1),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional(),
  employmentType: placementEmploymentTypeEnum.optional(),
});

export const createPipelineStageSchema = z.object({
  pipelineId: z.string().cuid(),
  name: z.string().min(1).max(100),
  order: z.coerce.number().int().min(1).optional(),
  type: pipelineStageTypeEnum.optional(),
});

export const updatePipelineStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.coerce.number().int().min(1).optional(),
  type: pipelineStageTypeEnum.optional(),
});

export const createChecklistItemSchema = z.object({
  label: z.string().min(1).max(200),
  order: z.coerce.number().int().min(1).optional(),
});

export const updateChecklistItemSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  order: z.coerce.number().int().min(1).optional(),
});

export type PipelineStageInput = z.infer<typeof pipelineStageInputSchema>;
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;
export type CreatePipelineStageInput = z.infer<typeof createPipelineStageSchema>;
export type UpdatePipelineStageInput = z.infer<typeof updatePipelineStageSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
