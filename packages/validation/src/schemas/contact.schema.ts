import { z } from 'zod';

import { optionalId } from './optional-id';

export const contactStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const createContactSchema = z.object({
  companyId: z.string().cuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(150).optional(),
  status: contactStatusEnum.optional(),
  ownerId: optionalId,
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
