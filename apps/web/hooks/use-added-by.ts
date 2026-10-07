import { useMemo } from 'react';

import { isAdminSession } from '@/components/navigation';

import { useSession } from './use-session';
import { useUsers } from './use-users';

/** Names a record's owner — the "Added by" column of the admin's tables. */
export type AddedBy = (ownerId: string | null | undefined) => string;

/**
 * For the admin: who added a record, by the record's `ownerId`. Undefined for everyone else — a member only sees
 * what they added themselves, so their tables have no such column.
 */
export function useAddedBy(): AddedBy | undefined {
  const { data: session } = useSession();
  const isAdmin = isAdminSession(session);
  const { data: users } = useUsers({ page: 1, pageSize: 100 }, { enabled: isAdmin });

  return useMemo(() => {
    if (!isAdmin) return undefined;
    const names = new Map((users?.items ?? []).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return (ownerId) => (ownerId ? (names.get(ownerId) ?? '—') : '—');
  }, [isAdmin, users]);
}
