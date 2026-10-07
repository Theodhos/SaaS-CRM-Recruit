import { z } from 'zod';

import { optionalId } from './optional-id';

export const jobStatusEnum = z.enum(['OPEN', 'ON_HOLD', 'CLOSED']);
export const employmentTypeEnum = z.enum(['PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME']);

/** Years of experience: an empty input means "not set" (null clears a saved value), never 0. */
const experienceYears = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number().int().min(0).max(60).nullable().optional(),
);

const jobFields = z.object({
  companyId: optionalId,
  companyName: z.string().max(200).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  responsibilities: z.string().max(10_000).optional(),
  requirements: z.string().max(10_000).optional(),
  experienceYearsMin: experienceYears,
  experienceYearsMax: experienceYears,
  location: z.string().max(150).optional(),
  employmentType: employmentTypeEnum.optional(),
  salaryMin: z.coerce.number().nonnegative().optional(),
  salaryMax: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  compensationPackage: z.string().max(10_000).optional(),
  status: jobStatusEnum.optional(),
  ownerId: optionalId,
});

function experienceRangeInOrder(
  value: { experienceYearsMin?: number | null; experienceYearsMax?: number | null },
  ctx: z.RefinementCtx,
) {
  const { experienceYearsMin: min, experienceYearsMax: max } = value;
  if (typeof min === 'number' && typeof max === 'number' && max < min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['experienceYearsMax'],
      message: 'Must not be less than the minimum',
    });
  }
}

export const createJobSchema = jobFields.superRefine(experienceRangeInOrder);

export const updateJobSchema = jobFields.partial().superRefine(experienceRangeInOrder);

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
