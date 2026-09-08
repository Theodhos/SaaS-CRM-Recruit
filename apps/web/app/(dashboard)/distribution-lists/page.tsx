import { Send } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function DistributionListsPage() {
  return (
    <EmptyState
      icon={Send}
      title="Distribution Lists"
      description="Group contacts together for bulk outreach."
      actionLabel="Create List"
    />
  );
}
