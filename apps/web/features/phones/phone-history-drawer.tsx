'use client';

import { Badge, Button, Drawer, Textarea } from '@crm/ui';
import { Phone as PhoneIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useDeletePhone, usePhone, useUpdatePhoneCall } from '@/hooks/use-phones';
import type { Phone } from '@/services/phones.service';

import { CALL_STATUS_LABEL, CALL_STATUS_VARIANT, formatDuration } from './call-status';

/** A phone's record: who it is (and the CRM records it matched), then every call with outcome, duration, agent and note. */
export function PhoneHistoryDrawer({ phone, onClose, onCall }: { phone: Phone; onClose: () => void; onCall: (phone: Phone) => void }) {
  const { data, isLoading } = usePhone(phone.id);
  const update = useUpdatePhoneCall();
  const remove = useDeletePhone();
  const [editing, setEditing] = useState<{ id: string; notes: string } | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Remove ${phone.normalizedPhone} from the list?`)) return;
    await remove.mutateAsync(phone.id);
    onClose();
  }

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} title={phone.name ?? phone.normalizedPhone} description={phone.normalizedPhone}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-foreground/50">Email</dt>
            <dd>{phone.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Company</dt>
            <dd>{phone.company ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Source</dt>
            <dd>{phone.source ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Calls</dt>
            <dd>{phone.callCount}</dd>
          </div>
        </dl>
        {data && (data.candidate || data.contact || data.companyRef) ? (
          <p className="text-xs text-foreground/60">
            In the CRM:{' '}
            {data.candidate ? (
              <Link href={`/candidates/${data.candidate.id}`} className="text-primary hover:underline">
                candidate {data.candidate.firstName} {data.candidate.lastName}
              </Link>
            ) : null}
            {data.contact ? ` · contact ${data.contact.firstName} ${data.contact.lastName}` : ''}
            {data.companyRef ? (
              <>
                {' · '}
                <Link href={`/companies/${data.companyRef.id}`} className="text-primary hover:underline">
                  {data.companyRef.name}
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onCall(phone)} disabled={phone.status === 'DO_NOT_CALL'}>
            <PhoneIcon className="mr-1.5 h-4 w-4" /> Call {phone.normalizedPhone}
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={remove.isPending} aria-label="Delete phone">
            <Trash2 className="mr-1.5 h-4 w-4" /> Remove
          </Button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Call history</h3>
          {isLoading ? (
            <p className="text-sm text-foreground/50">Loading…</p>
          ) : !data || data.calls.length === 0 ? (
            <p className="text-sm text-foreground/50">Never called.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm" data-testid="call-history">
              {data.calls.map((call) => (
                <li key={call.id} className="flex flex-col gap-1 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{new Date(call.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <Badge variant={CALL_STATUS_VARIANT[call.status]}>{CALL_STATUS_LABEL[call.status]}</Badge>
                  </div>
                  <p className="text-xs text-foreground/50">
                    Duration: {formatDuration(call.durationSeconds)}
                    {call.user ? ` · Agent: ${call.user.firstName} ${call.user.lastName}` : ''}
                  </p>
                  {editing?.id === call.id ? (
                    <div className="flex flex-col gap-1.5">
                      <Textarea rows={2} className="min-h-0" value={editing.notes} onChange={(e) => setEditing({ id: call.id, notes: e.target.value })} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ callId: call.id, input: { notes: editing.notes } }, { onSuccess: () => setEditing(null) })}
                        >
                          Save note
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="text-left text-xs text-foreground/70 hover:underline" onClick={() => setEditing({ id: call.id, notes: call.notes ?? '' })}>
                      {call.notes ? call.notes : '+ Add note'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
