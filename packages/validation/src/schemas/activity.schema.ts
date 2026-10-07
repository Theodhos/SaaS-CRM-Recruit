import { z } from 'zod';

import { optionalId } from './optional-id';

export const activityTypeEnum = z.enum([
  'CALL', 'EMAIL', 'MEETING', 'INTERVIEW', 'NOTE', 'FOLLOW_UP', 'STATUS_CHANGE',
]);

export const createActivitySchema = z.object({
  type: activityTypeEnum,
  subject: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  scheduledAt: z.string().optional(),
  completedAt: z.string().optional(),
  candidateId: optionalId,
  companyId: optionalId,
  contactId: optionalId,
  jobId: optionalId,
  applicationId: optionalId,
});

export const updateActivitySchema = createActivitySchema.partial();

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
