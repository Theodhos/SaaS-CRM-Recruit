import { Folder } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function DocumentsPage() {
  return (
    <EmptyState
      icon={Folder}
      title="Documents"
      description="Store contracts, offer letters, and other files tied to your records."
      actionLabel="Upload Document"
    />
  );
}
