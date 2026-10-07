import type { TenantScopedEntity } from './base';
import type { UserSummary } from './user';

export type TeamMemberRole = 'LEAD' | 'MEMBER';

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  joinedAt: string;
  user: UserSummary;
}

export interface Team extends TenantScopedEntity {
  name: string;
  description: string | null;
  members: TeamMember[];
}
