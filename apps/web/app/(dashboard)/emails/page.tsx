import { Mail } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function EmailsPage() {
  return (
    <EmptyState
      icon={Mail}
      title="Emails"
      description="Read and send email threads linked to candidates and contacts."
      actionLabel="Compose"
    />
  );
}
