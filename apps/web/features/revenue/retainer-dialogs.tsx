'use client';

import { Button, Dialog, Input, Label, Select, SearchSelect } from '@crm/ui';
import { useState, type FormEvent } from 'react';

import { useCompanies } from '@/hooks/use-companies';
import { ApiClientError } from '@/lib/api-client';
import type { Retainer, RetainerInput, RetainerStatus } from '@/services/retainers.service';

import { CURRENCIES, dateInputValue, formatDate, formatMoney } from './money';

export const RETAINER_STATUS_LABEL: Record<RetainerStatus, string> = { ACTIVE: 'Active', EXPIRED: 'Expired', CANCELLED: 'Cancelled' };

/** Add or edit the standing agreement with a client company. Opened from a won client, the company is chosen already. */
export function RetainerFormDialog({
  retainer,
  company,
  defaultCurrency,
  onSubmit,
  onClose,
}: {
  retainer?: Retainer;
  company?: { id: string; name: string };
  defaultCurrency: string;
  onSubmit: (input: RetainerInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { data: companies } = useCompanies({ page: 1, pageSize: 100 });
  const [companyId, setCompanyId] = useState(retainer?.companyId ?? company?.id ?? '');
  const [amount, setAmount] = useState(retainer ? String(retainer.amount) : '');
  const [currency, setCurrency] = useState(retainer?.currency ?? defaultCurrency);
  const [startDate, setStartDate] = useState(retainer?.startDate.slice(0, 10) ?? dateInputValue());
  const [endDate, setEndDate] = useState(retainer ? (retainer.endDate?.slice(0, 10) ?? '') : dateInputValue(365));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const known = retainer?.company ?? company;
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [...CURRENCIES, currency];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!companyId) return setError('Choose the company.');
    if (amount.trim() === '' || Number.isNaN(value) || value < 0) return setError('Type what the company pays per month.');
    if (!startDate) return setError('Choose the start date.');
    if (endDate && endDate < startDate) return setError('The end date is before the start date.');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ companyId, amount: +value.toFixed(2), currency, startDate, endDate: endDate || null });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the retainer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={retainer ? 'Edit retainer' : 'Add retainer'}
      description="What a client company pays every month to keep recruiting for it."
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" data-testid="retainer-form">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retainer-company">Company</Label>
          {known ? (
            <p id="retainer-company" className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
              {known.name}
            </p>
          ) : (
            <SearchSelect id="retainer-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Choose a company…</option>
              {(companies?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SearchSelect>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retainer-amount">Amount per month</Label>
            <Input id="retainer-amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retainer-currency">Currency</Label>
            <Select id="retainer-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retainer-start">Start date</Label>
            <Input id="retainer-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retainer-end">End date</Label>
            <Input id="retainer-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <p className="text-xs text-foreground/50">Leave empty for an open-ended agreement.</p>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : retainer ? 'Save changes' : 'Create retainer'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Extends an agreement by whole months and keeps a record of the renewal. */
export function RenewRetainerDialog({
  retainer,
  onSubmit,
  onClose,
}: {
  retainer: Retainer;
  onSubmit: (input: { months: number; amount?: number }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [months, setMonths] = useState('12');
  const [amount, setAmount] = useState(String(retainer.amount));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const count = Number(months);
    const value = Number(amount);
    if (!Number.isInteger(count) || count < 1 || count > 60) return setError('Months: a whole number from 1 to 60.');
    if (amount.trim() === '' || Number.isNaN(value) || value < 0) return setError('Type the amount per month.');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ months: count, amount: +value.toFixed(2) });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not renew the retainer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Renew — ${retainer.company.name}`}
      description={
        retainer.status === 'EXPIRED'
          ? `Ended on ${formatDate(retainer.endDate)}: the new period starts today.`
          : retainer.endDate
            ? `Runs until ${formatDate(retainer.endDate)}: the months are added after that day.`
            : 'Open-ended: the months are counted from today.'
      }
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" data-testid="renew-form">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="renew-months">Extend by (months)</Label>
            <Input id="renew-months" type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="renew-amount">Amount per month ({retainer.currency})</Label>
            <Input id="renew-amount" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>

        {retainer.renewals.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Earlier renewals</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {retainer.renewals.map((renewal) => (
                <li key={renewal.id} className="flex justify-between gap-3">
                  <span>{formatDate(renewal.renewalDate)}</span>
                  <span className="tabular-nums">{formatMoney(renewal.amount, retainer.currency)} / month</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Renewing…' : 'Renew'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
