import { Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import type { LucideIcon } from 'lucide-react';

import type { MoneyTotals } from '@/services/fees.service';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ALL', 'CHF'] as const;

export const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Today (or a number of days from it) as the value of a date input. */
export function dateInputValue(daysFromNow = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Totals per currency, one line each: amounts in different currencies are never added together. */
export function moneyLines(totals: MoneyTotals | undefined, fallbackCurrency = 'USD') {
  const entries = Object.entries(totals ?? {});
  return entries.length === 0 ? [formatMoney(0, fallbackCurrency)] : entries.map(([currency, amount]) => formatMoney(amount, currency));
}

/** A figure on top of the Fees and Retainers pages — the same tile as the dashboard's numbers. */
export function RevenueTile({
  label,
  icon: Icon,
  lines,
  note,
  tone,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  /** Undefined while loading. */
  lines: string[] | undefined;
  note?: string;
  tone: string;
  active?: boolean;
  /** A tile that filters the table below it. */
  onClick?: () => void;
}) {
  const card = (
    <Card className={`h-full border-t-2 ${active ? 'ring-2 ring-ring' : ''}`} style={{ borderTopColor: tone }} data-testid="revenue-tile">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground/60">{label}</CardTitle>
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ backgroundColor: tone }}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        {lines === undefined ? (
          <div className="text-2xl font-bold">—</div>
        ) : (
          lines.map((line) => (
            <div key={line} className="text-2xl font-bold tabular-nums">
              {line}
            </div>
          ))
        )}
        {note ? <p className="mt-0.5 text-xs text-foreground/50">{note}</p> : null}
      </CardContent>
    </Card>
  );
  if (!onClick) return card;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="block rounded-lg text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </button>
  );
}
