import { Wallet } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function RetainersPage() {
  return (
    <EmptyState
      icon={Wallet}
      title="Retainers"
      description="Manage retained-search agreements with client companies."
      actionLabel="Add Retainer"
    />
  );
}
