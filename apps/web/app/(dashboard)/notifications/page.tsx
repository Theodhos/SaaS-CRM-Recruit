import { Bell } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function NotificationsPage() {
  return <EmptyState icon={Bell} title="Notifications" description="Your in-app notifications." />;
}
