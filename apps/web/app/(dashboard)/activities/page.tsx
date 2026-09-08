import { Activity } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function ActivitiesPage() {
  return (
    <EmptyState
      icon={Activity}
      title="Activities"
      description="Log calls, emails, meetings, and other candidate or company interactions."
      actionLabel="Log Activity"
    />
  );
}
