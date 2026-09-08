import { BarChart3 } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function ReportsPage() {
  return (
    <EmptyState
      icon={BarChart3}
      title="Reports"
      description="Build and save custom reports over your recruitment data."
      actionLabel="New Report"
    />
  );
}
