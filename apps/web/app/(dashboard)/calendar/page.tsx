import { Calendar as CalendarIcon } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function CalendarPage() {
  return (
    <EmptyState
      icon={CalendarIcon}
      title="Calendar"
      description="See scheduled interviews, meetings, and calls in one place."
      actionLabel="New Event"
    />
  );
}
