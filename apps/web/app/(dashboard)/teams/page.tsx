import { UsersRound } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function TeamsPage() {
  return (
    <EmptyState
      icon={UsersRound}
      title="Teams"
      description="Group users into teams for shared pipelines and reporting."
      actionLabel="Create Team"
    />
  );
}
