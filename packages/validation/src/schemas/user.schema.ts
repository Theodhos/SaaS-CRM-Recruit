import { z } from 'zod';

export const userStatusEnum = z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED']);

export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  roleId: z.string().cuid(),
  status: userStatusEnum.optional(),
  // Left blank -> a temporary password is auto-generated instead (see
  // UsersService.create). Blank comes through the form as '', not
  // undefined, so it's normalized before the length check applies.
  password: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(8).max(200).optional(),
  ),
  // The CRM pages this user works with (sidebar paths). Empty = every page a member may use.
  allowedSections: z.array(z.string().regex(/^\/[a-z0-9-]{1,60}$/)).max(50).optional(),
  // Sign-in asks this user for a code sent to their e-mail, after the password.
  loginOtpEnabled: z.boolean().optional(),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
