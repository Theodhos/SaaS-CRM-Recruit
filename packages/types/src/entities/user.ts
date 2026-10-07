import type { UserStatus } from '../common';

import type { TenantScopedEntity } from './base';

/** Minimal, non-sensitive user shape used for owner pickers, assignees, session display, etc. Never carries passwordHash. */
export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
}

export interface AuthenticatedUser extends TenantScopedEntity {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  role: { id: string; name: string };
  permissions: string[];
  /** The CRM pages the admin gave this user (sidebar paths). Empty = every page a member may use. */
  allowedSections: string[];
}

/** Full admin-directory shape (see apps/web (dashboard)/users) — same fields AuthenticatedUser has, minus permissions, plus roleId. */
export interface User extends TenantScopedEntity {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  allowedSections: string[];
  /** Sign-in asks this user for a code sent to their e-mail. */
  loginOtpEnabled: boolean;
  roleId: string;
  role: { id: string; name: string };
  teamMemberships: { team: { id: string; name: string } }[];
}
