import { z } from 'zod';

import { optionalId } from './optional-id';

export const placementStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']);
export const placementEmploymentTypeEnum = z.enum(['PERMANENT', 'TEMPORARY']);

export const createPlacementSchema = z.object({
  candidateId: z.string().cuid(),
  jobId: z.string().cuid(),
  companyId: z.string().cuid(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  status: placementStatusEnum.optional(),
  employmentType: placementEmploymentTypeEnum.optional(),
  ownerId: optionalId,
});

export const updatePlacementSchema = createPlacementSchema.partial();

export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;
export type UpdatePlacementInput = z.infer<typeof updatePlacementSchema>;
