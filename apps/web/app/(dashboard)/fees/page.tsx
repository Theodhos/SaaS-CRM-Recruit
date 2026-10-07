'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Label, Select, SearchSelect } from '@crm/ui';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Plus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { FEE_STATUS_LABEL, FeeFormDialog, RevenueTile, formatDate, formatMoney, moneyLines } from '@/features/revenue';
import { useCompanies } from '@/hooks/use-companies';
import { useCreateFee, useDeleteFee, useFees, useFeesOverview, useUpdateFee } from '@/hooks/use-fees';
import { useOrganisation } from '@/hooks/use-organisation';
import { ApiClientError } from '@/lib/api-client';
import { FEE_STATUS_COLOUR, employmentTypeColour } from '@/lib/status-colors';
import type { Fee, FeeInput, FeeStatus, FeeSuggestion } from '@/services/fees.service';

const STATUS_BADGE = FEE_STATUS_COLOUR;

const linkClass = 'font-medium hover:underline';

/**
 * Fees: what the agency charges a client company for a person it placed there — the money side of Active Employees.
 * On top the figures; then the people a fee still has to be created for, with the amount worked out from the pay
 * agreed on the pipeline; then every fee, from "to invoice" to "paid".
 */
function FeesView() {
  const router = useRouter();
  const companyId = useSearchParams().get('companyId') ?? '';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FeeStatus | ''>('');
  const [dialog, setDialog] = useState<{ fee?: Fee; suggestion?: FeeSuggestion } | null>(null);

  const { data: overview } = useFeesOverview();
  const { data, isLoading } = useFees({ page, pageSize: 25, status: status || undefined, companyId: companyId || undefined });
  const { data: companies } = useCompanies({ page: 1, pageSize: 100 });
  const { data: organisation } = useOrganisation();
  const createFee = useCreateFee();
  const updateFee = useUpdateFee();
  const deleteFee = useDeleteFee();

  const defaults = { currency: organisation?.payDefaults.currency ?? 'USD', paymentTermDays: organisation?.payDefaults.paymentTermDays ?? 30 };

  function filterBy(next: FeeStatus | '') {
    setStatus((current) => (current === next ? '' : next));
    setPage(1);
  }

  function filterByCompany(id: string) {
    router.replace(id ? `/fees?companyId=${id}` : '/fees');
    setPage(1);
  }

  async function setFeeStatus(fee: Fee, next: FeeStatus) {
    try {
      await updateFee.mutateAsync({ id: fee.id, input: { status: next } });
    } catch (error) {
      window.alert(error instanceof ApiClientError ? error.message : 'Could not update the fee.');
    }
  }

  function handleDelete(fee: Fee) {
    if (window.confirm(`Delete the fee of ${formatMoney(fee.amount, fee.currency)} for ${fee.placement.candidate.firstName} ${fee.placement.candidate.lastName}?`)) {
      deleteFee.mutate(fee.id);
    }
  }

  function handleSubmit(input: FeeInput) {
    return dialog?.fee ? updateFee.mutateAsync({ id: dialog.fee.id, input }) : createFee.mutateAsync(input);
  }

  const fees = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Fees</h2>
          <p className="mt-1 text-sm text-foreground/60">
            What client companies are charged for the people placed with them. Every fee belongs to one{' '}
            <Link href="/applications" className="text-primary hover:underline">
              active employee
            </Link>
            ; the monthly agreements are under{' '}
            <Link href="/retainers" className="text-primary hover:underline">
              Retainers
            </Link>
            .
          </p>
        </div>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setDialog({})}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add fee
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <RevenueTile
          label="Expected per month"
          icon={TrendingUp}
          lines={overview ? moneyLines(overview.expectedPerMonth, defaults.currency) : undefined}
          note={overview ? `from temporary employees · ${overview.activeEmployees} working now` : undefined}
          tone="var(--chart-series-1)"
        />
        <RevenueTile
          label="To invoice"
          icon={FileText}
          lines={overview ? moneyLines(overview.toInvoice, defaults.currency) : undefined}
          note="created, not invoiced yet"
          tone="#d97706"
          active={status === 'PENDING'}
          onClick={() => filterBy('PENDING')}
        />
        <RevenueTile
          label="Awaiting payment"
          icon={CalendarClock}
          lines={overview ? moneyLines(overview.awaitingPayment, defaults.currency) : undefined}
          note="invoiced, not paid yet"
          tone="#2563eb"
          active={status === 'INVOICED'}
          onClick={() => filterBy('INVOICED')}
        />
        <RevenueTile
          label="Overdue"
          icon={AlertTriangle}
          lines={overview ? moneyLines(overview.overdue, defaults.currency) : undefined}
          note={overview ? `${overview.overdueCount} fee${overview.overdueCount === 1 ? '' : 's'} past the due date` : undefined}
          tone="#dc2626"
          active={status === 'OVERDUE'}
          onClick={() => filterBy('OVERDUE')}
        />
        <RevenueTile
          label="Paid this year"
          icon={CheckCircle2}
          lines={overview ? moneyLines(overview.paidThisYear, defaults.currency) : undefined}
          tone="#047857"
          active={status === 'PAID'}
          onClick={() => filterBy('PAID')}
        />
      </div>

      {overview && overview.suggestions.length > 0 ? (
        <Card data-testid="fee-suggestions">
          <CardHeader>
            <CardTitle className="text-base">To charge now ({overview.suggestions.length})</CardTitle>
            <p className="mt-0.5 text-xs text-foreground/50">
              People working now without a fee: temporary employees are charged every month, permanent ones once. The amount comes from the pay
              agreed on the pipeline.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {overview.suggestions.map((suggestion) => (
                <li key={suggestion.placementId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <Link href={`/candidates/${suggestion.candidate.id}`} className={linkClass}>
                        {suggestion.candidate.firstName} {suggestion.candidate.lastName}
                      </Link>{' '}
                      <Badge variant={employmentTypeColour(suggestion.employmentType)} className="ml-1">
                        {suggestion.employmentType === 'TEMPORARY' ? 'Temporary · monthly' : 'Permanent · one-off'}
                      </Badge>
                    </p>
                    <p className="text-xs text-foreground/60">
                      {suggestion.job.title} ·{' '}
                      <Link href={`/companies/${suggestion.company.id}`} className="hover:underline">
                        {suggestion.company.name}
                      </Link>{' '}
                      · since {formatDate(suggestion.startDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{suggestion.amount === null ? 'No pay recorded' : formatMoney(suggestion.amount, suggestion.currency)}</p>
                      <p className="text-xs text-foreground/50">
                        {suggestion.basis
                          ? `${suggestion.basis.hourlyRate}/h × ${suggestion.basis.hoursPerDay} h × ${suggestion.basis.daysPerMonth} d × ${suggestion.basis.feePercent}%`
                          : 'type the amount yourself'}
                      </p>
                    </div>
                    <Button type="button" size="sm" onClick={() => setDialog({ suggestion })}>
                      Create fee
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee-status-filter">Status</Label>
          <Select
            id="fee-status-filter"
            className="w-44"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as FeeStatus | '');
              setPage(1);
            }}
          >
            <option value="">All fees</option>
            {(Object.keys(FEE_STATUS_LABEL) as FeeStatus[]).map((value) => (
              <option key={value} value={value}>
                {FEE_STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee-company-filter">Company</Label>
          <SearchSelect id="fee-company-filter" className="w-56" value={companyId} onChange={(event) => filterByCompany(event.target.value)}>
            <option value="">All companies</option>
            {(companies?.items ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </SearchSelect>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm" data-testid="fees-table">
            <thead className="border-b border-border bg-accent/40 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
              <tr>
                {['Employee', 'Company', 'Type', 'Amount', 'Status', 'Due', 'Paid', ''].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-2.5">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-foreground/50">
                    Loading…
                  </td>
                </tr>
              ) : fees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-foreground/50">
                    {status || companyId ? 'No fees match this filter.' : 'No fees yet. Create one from “To charge now” or with “Add fee”.'}
                  </td>
                </tr>
              ) : (
                fees.map((fee) => (
                  <tr key={fee.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/candidates/${fee.placement.candidate.id}`} className={linkClass}>
                        {fee.placement.candidate.firstName} {fee.placement.candidate.lastName}
                      </Link>
                      <p className="text-xs text-foreground/50">{fee.placement.job.title}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/companies/${fee.placement.company.id}`} className="hover:underline">
                        {fee.placement.company.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Badge variant={employmentTypeColour(fee.placement.employmentType)}>{fee.placement.employmentType === 'TEMPORARY' ? 'Temporary' : 'Permanent'}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">{formatMoney(fee.amount, fee.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Badge variant={STATUS_BADGE[fee.status]} data-testid="fee-status">
                        {FEE_STATUS_LABEL[fee.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(fee.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(fee.paidAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {fee.status === 'PENDING' ? (
                          <Button type="button" size="sm" onClick={() => void setFeeStatus(fee, 'INVOICED')}>
                            Mark invoiced
                          </Button>
                        ) : null}
                        {fee.status === 'INVOICED' || fee.status === 'OVERDUE' ? (
                          <Button type="button" size="sm" onClick={() => void setFeeStatus(fee, 'PAID')}>
                            Mark paid
                          </Button>
                        ) : null}
                        <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ fee })}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(fee)}>
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

      {dialog ? <FeeFormDialog fee={dialog.fee} suggestion={dialog.suggestion} defaults={defaults} onSubmit={handleSubmit} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

export default function FeesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-foreground/60">Loading…</p>}>
      <FeesView />
    </Suspense>
  );
}
