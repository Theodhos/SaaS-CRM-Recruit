import { Briefcase } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function JobsPage() {
  return (
    <EmptyState
      icon={Briefcase}
      title="Jobs"
      description="Post and manage open recruitment vacancies."
      actionLabel="Add Job"
    />
  );
}
