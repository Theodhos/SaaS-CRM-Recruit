import { RefreshCw } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function RenewalsPage() {
  return (
    <EmptyState
      icon={RefreshCw}
      title="Renewals"
      description="Track upcoming retainer renewals."
      actionLabel="Add Renewal"
    />
  );
}
