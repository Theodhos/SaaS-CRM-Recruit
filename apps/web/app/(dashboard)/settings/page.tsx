import { Settings } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function SettingsPage() {
  return (
    <EmptyState
      icon={Settings}
      title="Settings"
      description="Configure your organisation's preferences."
    />
  );
}
