/**
 * Frontend-safe mirrors of packages/database Prisma enums.
 *
 * apps/web must never import @crm/database (it pulls in the generated
 * Prisma client, which is Node-only and organisation-data-adjacent). These
 * literal unions are the frontend/shared contract instead. Keep in sync with
 * packages/database/prisma/schema.prisma — a Phase 2 task is to codegen this
 * file from the schema instead of hand-maintaining it.
 */

export type CandidateStatus = 'ACTIVE' | 'PASSIVE' | 'DO_NOT_CONTACT' | 'PLACED' | 'ARCHIVED';

export type JobStatus = 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'FILLED' | 'CANCELLED' | 'CLOSED';

export type ApplicationStatus = 'ACTIVE' | 'ON_HOLD' | 'REJECTED' | 'WITHDRAWN' | 'PLACED';

export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'INTERVIEW'
  | 'TASK'
  | 'NOTE'
  | 'STATUS_CHANGE'
  | 'DOCUMENT'
  | 'PLACEMENT'
  | 'FOLLOW_UP';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
