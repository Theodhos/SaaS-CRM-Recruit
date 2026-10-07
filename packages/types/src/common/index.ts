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

export type CompanyStatus = 'PROSPECT' | 'ACTIVE_CLIENT' | 'FORMER_CLIENT' | 'INACTIVE';

export type CompanyPipelineStage = 'NEW' | 'IN_CONVERSATION' | 'WIN' | 'LOST';

export type ContactStatus ='ACTIVE' | 'INACTIVE';

export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'TEMPORARY' | 'PART_TIME';

export type JobStatus = 'OPEN' | 'ON_HOLD' | 'CLOSED';

export type PipelineStageType = 'STANDARD' | 'PLACED' | 'REJECTED';

export type ApplicationStatus = 'ACTIVE' | 'ON_HOLD' | 'REJECTED' | 'WITHDRAWN' | 'PLACED';

export type ApplicationSource =
  | 'SOURCED'
  | 'INBOUND'
  | 'REFERRAL'
  | 'JOB_BOARD'
  | 'AGENCY'
  | 'CAREER_SITE'
  | 'OTHER';

export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'INTERVIEW'
  | 'NOTE'
  | 'FOLLOW_UP'
  | 'STATUS_CHANGE';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';

export type PlacementStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type DocumentType = 'CV' | 'RESUME' | 'COVER_LETTER' | 'CONTRACT' | 'OFFER_LETTER' | 'OTHER';

export type CalendarEventType = 'MEETING' | 'INTERVIEW' | 'CALL';

export type CalendarEventStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
