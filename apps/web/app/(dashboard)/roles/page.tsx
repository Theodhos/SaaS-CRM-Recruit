import { Shield } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function RolesPage() {
  return (
    <EmptyState
      icon={Shield}
      title="Roles"
      description="Define roles and the permissions they grant."
      actionLabel="Create Role"
    />
  );
}
