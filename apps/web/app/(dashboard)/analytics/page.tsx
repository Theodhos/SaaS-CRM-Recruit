import { BarChart3 } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function AnalyticsPage() {
  return (
    <EmptyState
      icon={BarChart3}
      title="Analytics"
      description="Recruitment performance metrics computed live from real data."
    />
  );
}
