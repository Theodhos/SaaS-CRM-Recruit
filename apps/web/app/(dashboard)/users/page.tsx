import { Users } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function UsersPage() {
  return (
    <EmptyState
      icon={Users}
      title="Users"
      description="Manage who has access to your organisation."
      actionLabel="Invite User"
    />
  );
}
