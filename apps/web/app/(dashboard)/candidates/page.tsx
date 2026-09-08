import { Users } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function CandidatesPage() {
  return (
    <EmptyState
      icon={Users}
      title="Candidates"
      description="Track and manage every candidate in your pipeline."
      actionLabel="Add Candidate"
    />
  );
}
