'use client';

import { Label, SearchSelect } from '@crm/ui';

import { isAdminSession } from '@/components/navigation';
import { useSession } from '@/hooks/use-session';
import { useUsers } from '@/hooks/use-users';

/**
 * The admin narrows a list to one user's records ("Added by"). Only the admin sees it — a member's lists hold
 * their own records anyway. `value` is the chosen user's id, '' = everyone.
 */
export function AddedByFilter({ value, onChange, className }: { value: string; onChange: (ownerId: string) => void; className?: string }) {
  const { data: session } = useSession();
  const isAdmin = isAdminSession(session);
  const { data: users } = useUsers({ page: 1, pageSize: 100 }, { enabled: isAdmin });
  if (!isAdmin) return null;

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label htmlFor="added-by-filter">Added by</Label>
      <SearchSelect id="added-by-filter" data-testid="added-by-filter" className="w-48" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All users</option>
        {(users?.items ?? [])
          .filter((user) => user.status !== 'DEACTIVATED')
          .map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
      </SearchSelect>
    </div>
  );
}
