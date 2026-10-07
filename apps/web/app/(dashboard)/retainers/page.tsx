'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Label, Select } from '@crm/ui';
import { CalendarClock, Handshake, Hourglass, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { RETAINER_STATUS_LABEL, RenewRetainerDialog, RetainerFormDialog, RevenueTile, formatDate, formatMoney, moneyLines } from '@/features/revenue';
import { useOrganisation } from '@/hooks/use-organisation';
import { useCreateRetainer, useDeleteRetainer, useRenewRetainer, useRetainers, useRetainersOverview, useUpdateRetainer } from '@/hooks/use-retainers';
import { ApiClientError } from '@/lib/api-client';
import { RETAINER_STATUS_COLOUR } from '@/lib/status-colors';
import type { Retainer, RetainerInput, RetainerStatus } from '@/services/retainers.service';

const STATUS_BADGE = RETAINER_STATUS_COLOUR;

/**
 * Retainers: the standing agreement with a client company — what it pays every month so the agency keeps recruiting
 * for it. It is the money side of a company that was won (Pipeline Companies → Win), next to the fees charged per
 * person placed there (the Fees page).
 */
export default function RetainersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RetainerStatus | ''>('');
  const [form, setForm] = useState<{ retainer?: Retainer; company?: { id: string; name: string } } | null>(null);
  const [renewing, setRenewing] = useState<Retainer | null>(null);

  const { data: overview } = useRetainersOverview();
  const { data, isLoading } = useRetainers({ page, pageSize: 25, status: status || undefined });
  const { data: organisation } = useOrganisation();
  const createRetainer = useCreateRetainer();
  const updateRetainer = useUpdateRetainer();
  const renewRetainer = useRenewRetainer();
  const deleteRetainer = useDeleteRetainer();

  const currency = organisation?.payDefaults.currency ?? 'USD';

  function filterBy(next: RetainerStatus | '') {
    setStatus((current) => (current === next ? '' : next));
    setPage(1);
  }

  function handleSubmit(input: RetainerInput) {
    return form?.retainer ? updateRetainer.mutateAsync({ id: form.retainer.id, input }) : createRetainer.mutateAsync(input);
  }

  async function handleCancel(retainer: Retainer) {
    if (!window.confirm(`Cancel the retainer with ${retainer.company.name}? It stays in the list as cancelled.`)) return;
    try {
      await updateRetainer.mutateAsync({ id: retainer.id, input: { status: 'CANCELLED' } });
    } catch (error) {
      window.alert(error instanceof ApiClientError ? error.message : 'Could not cancel the retainer.');
    }
  }

  function handleDelete(retainer: Retainer) {
    if (window.confirm(`Delete the retainer with ${retainer.company.name} and its renewals? This can't be undone.`)) {
      deleteRetainer.mutate(retainer.id);
    }
  }

  const retainers = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Retainers</h2>
          <p className="mt-1 text-sm text-foreground/60">
            The monthly agreements with client companies — for the companies won on{' '}
            <Link href="/pipeline-companies" className="text-primary hover:underline">
              Pipeline Companies
            </Link>
            . What is charged per person placed is under{' '}
            <Link href="/fees" className="text-primary hover:underline">
              Fees
            </Link>
            .
          </p>
        </div>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setForm({})}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add retainer
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevenueTile
          label="Active agreements"
          icon={Handshake}
          lines={overview ? [overview.active.toLocaleString()] : undefined}
          tone="#047857"
          active={status === 'ACTIVE'}
          onClick={() => filterBy('ACTIVE')}
        />
        <RevenueTile label="Income per month" icon={TrendingUp} lines={overview ? moneyLines(overview.perMonth, currency) : undefined} note="from active agreements" tone="var(--chart-series-1)" />
        <RevenueTile label="Ending within 30 days" icon={CalendarClock} lines={overview ? [overview.endingSoon.toLocaleString()] : undefined} note="time to talk about renewing" tone="#d97706" />
        <RevenueTile
          label="Expired"
          icon={Hourglass}
          lines={overview ? [overview.expired.toLocaleString()] : undefined}
          note="renew them or close them"
          tone="#dc2626"
          active={status === 'EXPIRED'}
          onClick={() => filterBy('EXPIRED')}
        />
      </div>

      {overview && overview.withoutRetainer.length > 0 ? (
        <Card data-testid="retainer-suggestions">
          <CardHeader>
            <CardTitle className="text-base">Won clients without a retainer ({overview.withoutRetainer.length})</CardTitle>
            <p className="mt-0.5 text-xs text-foreground/50">Companies in the Win stage that have no agreement running.</p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {overview.withoutRetainer.map((company) => (
                <li key={company.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link href={`/companies/${company.id}`} className="text-sm font-medium hover:underline">
                      {company.name}
                    </Link>
                    <p className="text-xs text-foreground/60">
                      {company.jobs} job{company.jobs === 1 ? '' : 's'} · {company.employees} placed
                    </p>
                  </div>
                  <Button type="button" size="sm" onClick={() => setForm({ company: { id: company.id, name: company.name } })}>
                    Add retainer
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retainer-status-filter">Status</Label>
          <Select
            id="retainer-status-filter"
            className="w-44"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as RetainerStatus | '');
              setPage(1);
            }}
          >
            <option value="">All retainers</option>
            {(Object.keys(RETAINER_STATUS_LABEL) as RetainerStatus[]).map((value) => (
              <option key={value} value={value}>
                {RETAINER_STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm" data-testid="retainers-table">
            <thead className="border-b border-border bg-accent/40 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
              <tr>
                {['Company', 'Per month', 'Period', 'Status', 'Renewals', ''].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-2.5">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-foreground/50">
                    Loading…
                  </td>
                </tr>
              ) : retainers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-foreground/50">
                    {status ? 'No retainers match this filter.' : 'No retainers yet. Add one with “Add retainer”.'}
                  </td>
                </tr>
              ) : (
                retainers.map((retainer) => (
                  <tr key={retainer.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/companies/${retainer.company.id}`} className="font-medium hover:underline">
                        {retainer.company.name}
                      </Link>
                      <p className="text-xs text-foreground/50">
                        {retainer.company._count.placements} placed ·{' '}
                        <Link href={`/fees?companyId=${retainer.company.id}`} className="text-primary hover:underline">
                          fees
                        </Link>
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">{formatMoney(retainer.amount, retainer.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {formatDate(retainer.startDate)} → {retainer.endDate ? formatDate(retainer.endDate) : 'open-ended'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Badge variant={STATUS_BADGE[retainer.status]} data-testid="retainer-status">
                        {RETAINER_STATUS_LABEL[retainer.status]}
                      </Badge>
                      {retainer.endsSoon ? (
                        <Badge variant="warning" className="ml-1.5">
                          {retainer.daysLeft !== null && retainer.daysLeft <= 0 ? 'ends today' : `ends in ${retainer.daysLeft} day${retainer.daysLeft === 1 ? '' : 's'}`}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">{retainer.renewals.length}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {retainer.status !== 'CANCELLED' ? (
                          <Button type="button" size="sm" onClick={() => setRenewing(retainer)}>
                            Renew
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="outline" onClick={() => setForm({ retainer })}>
                          Edit
                        </Button>
                        {retainer.status === 'ACTIVE' ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleCancel(retainer)}>
                            Cancel
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(retainer)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm text-foreground/60">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {data.page} of {data.totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>

      {form ? <RetainerFormDialog retainer={form.retainer} company={form.company} defaultCurrency={currency} onSubmit={handleSubmit} onClose={() => setForm(null)} /> : null}
      {renewing ? (
        <RenewRetainerDialog retainer={renewing} onSubmit={(input) => renewRetainer.mutateAsync({ id: renewing.id, input })} onClose={() => setRenewing(null)} />
      ) : null}
    </div>
  );
}
