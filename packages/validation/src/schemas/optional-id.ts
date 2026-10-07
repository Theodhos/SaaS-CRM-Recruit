import { z } from 'zod';

/**
 * An optional reference to another record, as a form's `<select>` submits it: a cuid when something was chosen,
 * `""` for the "none" option. The empty string becomes `undefined`, so "no company / no candidate" is a valid
 * choice instead of a cuid error the user cannot fix.
 */
export const optionalId = z
  .string()
  .cuid()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value === '' ? undefined : value));
