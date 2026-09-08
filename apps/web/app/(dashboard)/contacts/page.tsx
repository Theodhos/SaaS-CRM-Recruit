import { Contact } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function ContactsPage() {
  return (
    <EmptyState
      icon={Contact}
      title="Contacts"
      description="Keep track of the people you work with at each company."
      actionLabel="Add Contact"
    />
  );
}
