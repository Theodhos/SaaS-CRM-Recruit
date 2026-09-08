import { CheckSquare } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function TasksPage() {
  return (
    <EmptyState
      icon={CheckSquare}
      title="Tasks"
      description="Track work that needs to get done, assigned across your team."
      actionLabel="Add Task"
    />
  );
}
