import type { BadgeProps } from '@crm/ui';

type Colour = NonNullable<BadgeProps['variant']>;

/**
 * The one colour language for every Status and Type badge of the platform, so the same colour means the same thing
 * on every page (the way a CRM reads at a glance):
 *
 *   green  = live / good / done well        (active, open, paid, answered, high)
 *   blue   = new / in progress              (prospect, invited, invoiced, initiated)
 *   amber  = waiting / needs attention      (pending, on hold, suspended, medium, former client)
 *   red    = stopped / failed               (rejected, cancelled, overdue, deactivated, do not contact)
 *   slate  = closed / over / quiet          (closed, completed, archived, inactive, no answer, low)
 *   orange = lapsed                         (expired, busy)
 *
 * Types are not good or bad, so they get the colours no status uses: violet, teal, orange, blue.
 */

export const COMPANY_STATUS_COLOUR: Record<'PROSPECT' | 'ACTIVE_CLIENT' | 'FORMER_CLIENT' | 'INACTIVE', Colour> = {
  PROSPECT: 'default',
  ACTIVE_CLIENT: 'success',
  FORMER_CLIENT: 'warning',
  INACTIVE: 'slate',
};

export const JOB_STATUS_COLOUR: Record<'OPEN' | 'ON_HOLD' | 'CLOSED', Colour> = {
  OPEN: 'success',
  ON_HOLD: 'warning',
  CLOSED: 'slate',
};

export const PLACEMENT_STATUS_COLOUR: Record<'ACTIVE' | 'COMPLETED' | 'CANCELLED', Colour> = {
  ACTIVE: 'success',
  COMPLETED: 'slate',
  CANCELLED: 'destructive',
};

export const CANDIDATE_STATUS_COLOUR: Record<'ACTIVE' | 'PASSIVE' | 'DO_NOT_CONTACT' | 'PLACED' | 'ARCHIVED', Colour> = {
  ACTIVE: 'success',
  PASSIVE: 'warning',
  DO_NOT_CONTACT: 'destructive',
  PLACED: 'teal',
  ARCHIVED: 'slate',
};

/** The candidate's review outcome (REAPPLIED reads "Active", SUGGESTED reads "Rejected"). */
export const REVIEW_STATUS_COLOUR: Record<'PENDING' | 'ACTIVE' | 'REJECTED' | 'REAPPLIED' | 'SUGGESTED', Colour> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  REJECTED: 'destructive',
  REAPPLIED: 'success',
  SUGGESTED: 'destructive',
};

export const CONTACT_STATUS_COLOUR: Record<'ACTIVE' | 'INACTIVE', Colour> = { ACTIVE: 'success', INACTIVE: 'slate' };

export const FEE_STATUS_COLOUR: Record<'PENDING' | 'INVOICED' | 'PAID' | 'OVERDUE' | 'CANCELLED', Colour> = {
  PENDING: 'warning',
  INVOICED: 'default',
  PAID: 'success',
  OVERDUE: 'destructive',
  CANCELLED: 'slate',
};

export const RETAINER_STATUS_COLOUR: Record<'ACTIVE' | 'EXPIRED' | 'CANCELLED', Colour> = {
  ACTIVE: 'success',
  EXPIRED: 'orange',
  CANCELLED: 'slate',
};

export const USER_STATUS_COLOUR: Record<'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED', Colour> = {
  ACTIVE: 'success',
  INVITED: 'default',
  SUSPENDED: 'warning',
  DEACTIVATED: 'destructive',
};

export const CALL_STATUS_COLOUR: Record<'INITIATED' | 'RINGING' | 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'REJECTED' | 'ENDED', Colour> = {
  INITIATED: 'default',
  RINGING: 'warning',
  ANSWERED: 'success',
  NO_ANSWER: 'slate',
  BUSY: 'orange',
  FAILED: 'destructive',
  REJECTED: 'destructive',
  ENDED: 'success',
};

export const POTENTIAL_COLOUR: Record<'High' | 'Medium' | 'Low', Colour> = { High: 'success', Medium: 'warning', Low: 'slate' };

export const TEAM_ROLE_COLOUR: Record<'LEAD' | 'MEMBER', Colour> = { LEAD: 'violet', MEMBER: 'slate' };

/** How someone is (to be) employed — a job's type, a pipeline's, an Active Employees entry's. */
const EMPLOYMENT_TYPE: Record<string, Colour> = {
  PERMANENT: 'violet',
  TEMPORARY: 'teal',
  CONTRACT: 'orange',
  PART_TIME: 'default',
};
export const employmentTypeColour = (type: string | null | undefined): Colour => EMPLOYMENT_TYPE[type ?? ''] ?? 'slate';

/** A user's role is a type: Admin violet, Manager teal, Instructor blue. */
const ROLE: Record<string, Colour> = { Admin: 'violet', Manager: 'teal', Instructor: 'default' };
export const roleColour = (role: string | null | undefined): Colour => ROLE[role ?? ''] ?? 'slate';

/** What a notification is about, read from its type: good news green, something new blue, needs attention amber, bad news red. */
export function notificationColour(type: string): Colour {
  if (/REJECT|FAIL|CANCEL|TERMINAT|OVERDUE/.test(type)) return 'destructive';
  if (/INCOMPLETE|MISSING|REMINDER|EXPIR|PENDING/.test(type)) return 'warning';
  if (/PLACED|HIRED|PAID|COMPLETED|APPROVED/.test(type)) return 'success';
  if (/NEW|CREATED|ASSIGNED|APPLIED/.test(type)) return 'default';
  return 'slate';
}
