'use client';

import type { Team } from '@crm/types';
import { Badge, Button, Select, SearchSelect } from '@crm/ui';
import { Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { useActiveUsers } from '@/hooks/use-users';
import { TEAM_ROLE_COLOUR } from '@/lib/status-colors';

const ROLE_VARIANT = TEAM_ROLE_COLOUR;

export interface TeamMembersProps {
  team: Team;
  onAdd: (userId: string, role: 'LEAD' | 'MEMBER') => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

/**
 * The whole point of the request this satisfies: a place where users get
 * linked to each other, not just to a name on a card — pick anyone active
 * in the org who isn't already on the team, give them LEAD or MEMBER, and
 * they show up below immediately.
 */
export function TeamMembers({ team, onAdd, onRemove }: TeamMembersProps) {
  const { data: activeUsers } = useActiveUsers();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'LEAD' | 'MEMBER'>('MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberUserIds = new Set(team.members.map((member) => member.userId));
  const availableUsers = (activeUsers ?? []).filter((user) => !memberUserIds.has(user.id));

  async function handleAdd() {
    if (!selectedUserId) return;
    setIsSubmitting(true);
    try {
      await onAdd(selectedUserId, selectedRole);
      setSelectedUserId('');
      setSelectedRole('MEMBER');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <SearchSelect value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
            <option value="">Select a user to add…</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </SearchSelect>
        </div>
        <Select
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as 'LEAD' | 'MEMBER')}
          className="w-32"
        >
          <option value="MEMBER">Member</option>
          <option value="LEAD">Lead</option>
        </Select>
        <Button type="button" disabled={!selectedUserId || isSubmitting} onClick={handleAdd}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      {team.members.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {team.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {member.user.firstName} {member.user.lastName}
                </p>
                <p className="text-xs text-foreground/50">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={ROLE_VARIANT[member.role]}>{member.role}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(member.userId)}
                  aria-label="Remove from team"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-foreground/50">No members on this team yet.</p>
      )}
    </div>
  );
}
