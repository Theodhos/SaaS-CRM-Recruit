'use client';

import { Badge, Dialog } from '@crm/ui';
import type { ReactNode } from 'react';

import type { ContactWithCompany } from '@/services/contacts.service';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="text-sm">{value === null || value === undefined || value === '' ? '—' : value}</dd>
    </div>
  );
}

/** Everything on file about one person at a client company (CEO, HR manager, hiring manager…). */
export function PersonDialog({ person, onClose }: { person: ContactWithCompany; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`${person.firstName} ${person.lastName}`} description={person.jobTitle ?? 'Contact'}>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="person-dialog">
        <Field label="Role / title" value={person.jobTitle} />
        <Field label="Company" value={person.company?.name} />
        <Field
          label="Email"
          value={
            person.email ? (
              <a href={`mailto:${person.email}`} className="text-primary hover:underline">
                {person.email}
              </a>
            ) : null
          }
        />
        <Field
          label="Phone"
          value={
            person.phone ? (
              <a href={`tel:${person.phone}`} className="text-primary hover:underline">
                {person.phone}
              </a>
            ) : null
          }
        />
        <Field label="Status" value={<Badge variant={person.status === 'ACTIVE' ? 'success' : 'slate'}>{String(person.status).replaceAll('_', ' ')}</Badge>} />
        <Field label="Managed by" value={person.owner ? `${person.owner.firstName} ${person.owner.lastName}` : null} />
        <Field label="Added" value={new Date(person.createdAt).toLocaleDateString()} />
        <Field label="Last updated" value={new Date(person.updatedAt).toLocaleDateString()} />
      </dl>
    </Dialog>
  );
}
