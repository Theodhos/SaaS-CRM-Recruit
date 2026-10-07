import { z } from 'zod';

import { optionalId } from './optional-id';

export const companyStatusEnum = z.enum([
  'PROSPECT',
  'ACTIVE_CLIENT',
  'FORMER_CLIENT',
  'INACTIVE',
]);

export const companyPipelineStageEnum = z.enum(['NEW', 'IN_CONVERSATION', 'WIN', 'LOST']);

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(150).optional(),
  website: z.string().url().max(300).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(150).optional(),
  country: z.string().max(150).optional(),
  status: companyStatusEnum.optional(),
  pipelineStage: companyPipelineStageEnum.optional(),
  about: z.string().max(10000).optional(),
  ownerId: optionalId,
});

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
