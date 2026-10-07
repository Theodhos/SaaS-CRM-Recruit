import { z } from 'zod';

import { optionalId } from './optional-id';

export const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().optional(),
  assignedToId: optionalId,
  candidateId: optionalId,
  companyId: optionalId,
  contactId: optionalId,
  jobId: optionalId,
  applicationId: optionalId,
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
