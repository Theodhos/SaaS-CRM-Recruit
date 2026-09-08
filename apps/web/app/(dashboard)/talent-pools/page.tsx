import { UsersRound } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function TalentPoolsPage() {
  return (
    <EmptyState
      icon={UsersRound}
      title="Talent Pools"
      description="Group candidates into reusable talent pools."
      actionLabel="Create Talent Pool"
    />
  );
}
