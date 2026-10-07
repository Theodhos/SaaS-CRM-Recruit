import { z } from 'zod';

import { optionalId } from './optional-id';

/**
 * Reference implementation of the shared-schema pattern. One file per
 * domain entity's write operations, consumed by both React Hook Form
 * (apps/web) and NestJS DTOs via a class-validator/zod bridge (apps/api).
 * Add sibling files (company.schema.ts, job.schema.ts, ...) alongside each
 * module's Phase 2 implementation rather than pre-building all of them now.
 */
export const candidateStatusEnum = z.enum([
  'ACTIVE',
  'PASSIVE',
  'DO_NOT_CONTACT',
  'PLACED',
  'ARCHIVED',
]);

export const createCandidateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  location: z.string().max(150).optional(),
  jobTitle: z.string().max(150).optional(),
  currentCompany: z.string().max(150).optional(),
  source: z.string().max(100).optional(),
  status: candidateStatusEnum.optional(),
  ownerId: optionalId,
  interestedJobId: z
    .string()
    .cuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value === '' ? undefined : value)),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
