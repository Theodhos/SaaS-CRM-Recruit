import { Building2 } from 'lucide-react';

import { EmptyState } from '@/components/shared';

export default function CompaniesPage() {
  return (
    <EmptyState
      icon={Building2}
      title="Companies"
      description="Manage the client companies you recruit for."
      actionLabel="Add Company"
    />
  );
}
