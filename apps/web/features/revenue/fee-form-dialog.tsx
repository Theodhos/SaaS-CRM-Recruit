'use client';

import { Button, Dialog, Input, Label, Select, SearchSelect } from '@crm/ui';
import { useState, type FormEvent } from 'react';

import { usePlacements } from '@/hooks/use-placements';
import { ApiClientError } from '@/lib/api-client';
import type { Fee, FeeInput, FeeStatus, FeeSuggestion } from '@/services/fees.service';

import { CURRENCIES, dateInputValue } from './money';

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  PENDING: 'To invoice',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

/**
 * Add or edit a fee. A fee is always for one person who was hired (an Active Employees entry); opened from a
 * suggestion, the person and the amount worked out from their pay are filled in already.
 */
export function FeeFormDialog({
  fee,
  suggestion,
  defaults,
  onSubmit,
  onClose,
}: {
  fee?: Fee;
  suggestion?: FeeSuggestion;
  defaults: { currency: string; paymentTermDays: number };
  onSubmit: (input: FeeInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { data: placements } = usePlacements({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const [placementId, setPlacementId] = useState(fee?.placementId ?? suggestion?.placementId ?? '');
  const [amount, setAmount] = useState(fee ? String(fee.amount) : suggestion?.amount != null ? String(suggestion.amount) : '');
  const [currency, setCurrency] = useState(fee?.currency ?? suggestion?.currency ?? defaults.currency);
  const [dueDate, setDueDate] = useState(fee ? (fee.dueDate?.slice(0, 10) ?? '') : dateInputValue(defaults.paymentTermDays));
  // "Overdue" is worked out from the due date, it is never chosen
  const [status, setStatus] = useState<FeeStatus>(fee && fee.status !== 'OVERDUE' ? fee.status : fee ? 'INVOICED' : 'PENDING');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const known = fee?.placement ?? suggestion;
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [...CURRENCIES, currency];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!placementId) return setError('Choose the employee this fee is for.');
    if (amount.trim() === '' || Number.isNaN(value) || value < 0) return setError('Type the amount.');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ placementId, amount: +value.toFixed(2), currency, status, dueDate: dueDate || null });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the fee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={fee ? 'Edit fee' : 'Add fee'} description="What the client company is charged for a person placed there.">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" data-testid="fee-form">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee-placement">Employee</Label>
          {known ? (
            <p id="fee-placement" className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
              {known.candidate.firstName} {known.candidate.lastName} · {known.job.title} · {known.company.name}
            </p>
          ) : (
            <SearchSelect id="fee-placement" value={placementId} onChange={(e) => setPlacementId(e.target.value)}>
              <option value="">Choose an active employee…</option>
              {(placements?.items ?? []).map((placement) => (
                <option key={placement.id} value={placement.id}>
                  {placement.candidate.firstName} {placement.candidate.lastName} · {placement.job.title} · {placement.company.name}
                </option>
              ))}
            </SearchSelect>
          )}
          {suggestion?.basis ? (
            <p className="text-xs text-foreground/50">
              From the pay agreed on the pipeline: {suggestion.basis.hourlyRate}/h × {suggestion.basis.hoursPerDay} h × {suggestion.basis.daysPerMonth} days ×{' '}
              {suggestion.basis.feePercent}%.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fee-amount">Amount</Label>
            <Input id="fee-amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fee-currency">Currency</Label>
            <Select id="fee-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fee-due">Due date</Label>
            <Input id="fee-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fee-status">Status</Label>
            <Select id="fee-status" value={status} onChange={(e) => setStatus(e.target.value as FeeStatus)}>
              {(['PENDING', 'INVOICED', 'PAID', 'CANCELLED'] as const).map((value) => (
                <option key={value} value={value}>
                  {FEE_STATUS_LABEL[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : fee ? 'Save changes' : 'Create fee'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
