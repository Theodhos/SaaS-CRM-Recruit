import { GitBranch } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function PipelinePage() {
  return (
    <EmptyState
      icon={GitBranch}
      title="Pipeline"
      description="Configure the recruitment stages your applications move through."
      actionLabel="New Pipeline"
    />
  );
}
