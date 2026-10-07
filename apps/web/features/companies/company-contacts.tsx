'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Drawer } from '@crm/ui';
import type { CreateContactInput } from '@crm/validation';
import { Mail, Pencil, Phone, Plus, Trash2, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ContactForm } from '@/features/contacts';
import { useContacts, useCreateContact, useDeleteContact, useUpdateContact } from '@/hooks/use-contacts';
import { groupContacts } from '@/lib/contact-roles';
import { toFormDefaults } from '@/lib/form-defaults';
import { CONTACT_STATUS_COLOUR } from '@/lib/status-colors';
import type { ContactWithCompany } from '@/services/contacts.service';

const STATUS_VARIANT = CONTACT_STATUS_COLOUR;

function initials(contact: { firstName: string; lastName: string }) {
  return `${contact.firstName.charAt(0)}${contact.lastName.charAt(0)}`.toUpperCase();
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

/**
 * Everyone we know at a company — CEO, co-founders, HR, and every other contact — grouped by what they do, with every
 * detail on file for each person. This is where contacts live: they are added, edited and removed here, on the company
 * they belong to (there is no separate Contacts page).
 */
export function CompanyContacts({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { data, isLoading } = useContacts({ companyId, pageSize: 100 });
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit'; contact?: ContactWithCompany } | null>(null);

  const groups = useMemo(() => groupContacts(data?.items ?? []), [data]);
  const total = data?.totalItems ?? 0;

  async function handleSubmit(values: CreateContactInput) {
    if (drawer?.mode === 'edit' && drawer.contact) {
      await updateContact.mutateAsync({ id: drawer.contact.id, input: values });
    } else {
      await createContact.mutateAsync(values);
    }
    setDrawer(null);
  }

  function handleDelete(contact: ContactWithCompany) {
    if (window.confirm(`Remove ${contact.firstName} ${contact.lastName} from this company?`)) {
      deleteContact.mutate(contact.id);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersRound className="h-4 w-4 text-foreground/50" />
          Contacts ({total})
        </CardTitle>
        <Button type="button" size="sm" onClick={() => setDrawer({ mode: 'create' })}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add contact
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-foreground/50">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">
            No contacts yet — add the CEO, the co-founders, HR and anyone else you deal with at this company.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.group} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                {group.label} ({group.contacts.length})
              </h3>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {group.contacts.map((contact) => (
                  <li key={contact.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-foreground/70">
                          {initials(contact)}
                        </div>
                        <div>
                          <p className="font-medium">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-sm text-foreground/60">{contact.jobTitle ?? 'Role not set'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={STATUS_VARIANT[contact.status]}>{contact.status}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${contact.firstName} ${contact.lastName}`}
                          onClick={() => setDrawer({ mode: 'edit', contact })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${contact.firstName} ${contact.lastName}`}
                          onClick={() => handleDelete(contact)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
                        <Field label="Email">
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="break-all text-primary hover:underline">
                              {contact.email}
                            </a>
                          ) : (
                            '—'
                          )}
                        </Field>
                      </div>
                      <div className="flex min-w-0 items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
                        <Field label="Phone">
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                              {contact.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </Field>
                      </div>
                      <Field label="Account owner">
                        {contact.owner ? `${contact.owner.firstName} ${contact.owner.lastName}` : 'Unassigned'}
                      </Field>
                      <Field label="Status">{contact.status === 'ACTIVE' ? 'Active contact' : 'Inactive'}</Field>
                      <Field label="Added">{formatDate(contact.createdAt)}</Field>
                      <Field label="Last updated">{formatDate(contact.updatedAt)}</Field>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </CardContent>

      {drawer ? (
        <Drawer
          open
          onOpenChange={(open) => !open && setDrawer(null)}
          title={drawer.mode === 'edit' ? 'Edit contact' : 'Add contact'}
        >
          <ContactForm
            company={{ id: companyId, name: companyName }}
            defaultValues={drawer.contact ? toFormDefaults(drawer.contact) : { companyId }}
            submitLabel={drawer.mode === 'edit' ? 'Save changes' : 'Add contact'}
            onSubmit={handleSubmit}
          />
        </Drawer>
      ) : null}
    </Card>
  );
}
