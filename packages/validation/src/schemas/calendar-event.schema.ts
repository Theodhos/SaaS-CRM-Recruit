import { z } from 'zod';

import { optionalId } from './optional-id';

export const calendarEventTypeEnum = z.enum(['MEETING', 'INTERVIEW', 'CALL']);
export const calendarEventStatusEnum = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']);

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  type: calendarEventTypeEnum.optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  location: z.string().max(300).optional(),
  meetingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || /^https?:\/\/\S+\.\S+/i.test(value), 'A link starts with https:// — for example https://zoom.us/j/123')
    .optional(),
  status: calendarEventStatusEnum.optional(),
  candidateId: optionalId,
  contactId: optionalId,
  companyId: optionalId,
  jobId: optionalId,
  applicationId: optionalId,
});

export const updateCalendarEventSchema = createCalendarEventSchema.partial();

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
