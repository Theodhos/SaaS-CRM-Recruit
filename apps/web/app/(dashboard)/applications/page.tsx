import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function ApplicationsPage() {
  return (
    <EmptyState
      icon={FileText}
      title="Applications"
      description="See every candidate's progress through a job's pipeline."
      actionLabel="Add Application"
    />
  );
}
