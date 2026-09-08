import { Trophy } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function PlacementsPage() {
  return (
    <EmptyState
      icon={Trophy}
      title="Placements"
      description="Track successful recruitments from offer to start date."
      actionLabel="Add Placement"
    />
  );
}
