'use client';

import { Button, cn, Input } from '@crm/ui';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Eraser } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** A picked range of days, both included. Days are local calendar days, written 'YYYY-MM-DD'. */
export interface DateRange {
  /** The quick choice it came from ('last30', 'thisMonth'…), or 'custom' when the days were picked by hand. */
  preset: string;
  from: string;
  to: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDay(key: string) {
  return fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The quick choices on the left of the pop-up. "Last N days" counts today as the last of them. */
const PRESETS: { key: string; label: string; range: (today: Date) => [Date, Date] }[] = [
  { key: 'today', label: 'Today', range: (t) => [t, t] },
  { key: 'yesterday', label: 'Yesterday', range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: 'todayYesterday', label: 'Today and yesterday', range: (t) => [addDays(t, -1), t] },
  { key: 'last7', label: 'Last 7 days', range: (t) => [addDays(t, -6), t] },
  { key: 'last14', label: 'Last 14 days', range: (t) => [addDays(t, -13), t] },
  { key: 'last28', label: 'Last 28 days', range: (t) => [addDays(t, -27), t] },
  { key: 'last30', label: 'Last 30 days', range: (t) => [addDays(t, -29), t] },
  { key: 'thisWeek', label: 'This week', range: (t) => [addDays(t, -t.getDay()), t] },
  {
    key: 'lastWeek',
    label: 'Last week',
    range: (t) => [addDays(t, -t.getDay() - 7), addDays(t, -t.getDay() - 1)],
  },
  { key: 'thisMonth', label: 'This month', range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
  {
    key: 'lastMonth',
    label: 'Last month',
    range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)],
  },
];

/** The range as the API takes it: the first moment of its first day and the last moment of its last day. */
export function dateRangeBounds(range: DateRange | null) {
  if (!range) return { from: undefined, to: undefined };
  const end = fromKey(range.to);
  end.setHours(23, 59, 59, 999);
  return { from: fromKey(range.from).toISOString(), to: end.toISOString() };
}

/** What is being picked in the open pop-up: no range at all (Maximum), or a range whose last day may still be missing. */
type Draft = { preset: string; from: string; to: string | null } | null;

/**
 * The date filter of a board: a button that says what is picked ("Last 30 days: Sep 5, 2026 – Oct 4, 2026") and
 * opens a pop-up with quick choices on the left and two months side by side — click one day and then another for
 * a range of your own. Clear empties what is picked. Nothing changes outside until Update is pressed; `null` means
 * every date (Maximum), which is also what Update applies after Clear.
 */
export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(value);
  // the month shown on the left; the one after it is on the right
  const [view, setView] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Shows the month of `lastDay` on the right, the one before it on the left. */
  function showUpTo(lastDay: Date) {
    setView(new Date(lastDay.getFullYear(), lastDay.getMonth() - 1, 1));
  }

  function toggle() {
    if (!open) {
      setDraft(value);
      showUpTo(value ? fromKey(value.to) : new Date());
    }
    setOpen((isOpen) => !isOpen);
  }

  function pickPreset(key: string) {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const now = new Date();
    const [from, to] = preset.range(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setDraft({ preset: key, from: toKey(from), to: toKey(to) });
    showUpTo(to);
  }

  /** A click on a day: the first click starts a range, the second ends it (in either order). */
  function pickDay(key: string) {
    setDraft((current) => {
      if (!current || current.to !== null) return { preset: 'custom', from: key, to: null };
      return key < current.from
        ? { preset: 'custom', from: key, to: current.from }
        : { preset: 'custom', from: current.from, to: key };
    });
  }

  function apply() {
    onChange(draft ? { preset: draft.preset, from: draft.from, to: draft.to ?? draft.from } : null);
    setOpen(false);
  }

  const presetLabel = (key: string) => PRESETS.find((p) => p.key === key)?.label;
  const rangeText = (from: string, to: string) =>
    from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
  const summary = !value
    ? 'Maximum'
    : presetLabel(value.preset)
      ? `${presetLabel(value.preset)}: ${rangeText(value.from, value.to)}`
      : rangeText(value.from, value.to);

  const todayKey = toKey(new Date());
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, index) => thisYear - 10 + index);
  if (!years.includes(view.getFullYear())) years.unshift(view.getFullYear());

  function month(offset: number) {
    const first = new Date(view.getFullYear(), view.getMonth() + offset, 1);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const selectClass =
      'h-8 cursor-pointer rounded-md bg-transparent px-1 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
    // the selects show this pane's month; the left pane always stays `offset` months before it
    const show = (year: number, monthIndex: number) => setView(new Date(year, monthIndex - offset, 1));
    return (
      <div className="w-[17.5rem]">
        <div className="flex h-8 items-center justify-between">
          {offset === 0 ? (
            <button
              type="button"
              aria-label="Previous month"
              className="rounded-md p-1.5 hover:bg-accent"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="w-7" />
          )}
          <div className="flex items-center gap-2">
            <select
              aria-label="Month"
              className={selectClass}
              value={first.getMonth()}
              onChange={(e) => show(first.getFullYear(), Number(e.target.value))}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              className={selectClass}
              value={first.getFullYear()}
              onChange={(e) => show(Number(e.target.value), first.getMonth())}
            >
              {[...new Set([...years, first.getFullYear()])].sort().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {offset === 1 ? (
            <button
              type="button"
              aria-label="Next month"
              className="rounded-md p-1.5 hover:bg-accent"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="w-7" />
          )}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-sm">
          {WEEKDAYS.map((name) => (
            <span key={name} className="py-1 text-xs text-foreground/50">
              {name}
            </span>
          ))}
          {Array.from({ length: first.getDay() }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const key = toKey(new Date(first.getFullYear(), first.getMonth(), index + 1));
            const end = draft ? (draft.to ?? draft.from) : null;
            const isEdge = draft !== null && (key === draft.from || key === end);
            const inRange = draft !== null && end !== null && key > draft.from && key < end;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isEdge || inRange}
                onClick={() => pickDay(key)}
                className={cn(
                  'h-9 text-sm hover:bg-accent',
                  key === todayKey && 'font-semibold underline underline-offset-4',
                  inRange && 'bg-blue-100 text-blue-950 hover:bg-blue-200',
                  isEdge && 'rounded-md bg-blue-600 font-semibold text-white hover:bg-blue-700',
                  !isEdge && !inRange && 'rounded-md',
                )}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)} data-testid="date-range-filter">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="date-range-button"
      >
        <CalendarDays className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Date range"
          className="fixed inset-x-2 top-20 z-50 flex max-h-[80vh] overflow-auto rounded-lg border border-border bg-background shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-1 lg:max-h-none lg:w-max"
        >
          <ul className="w-48 shrink-0 border-r border-border py-2 text-sm">
            {[{ key: '', label: 'Maximum' }, ...PRESETS].map((preset) => {
              const picked = preset.key === '' ? draft === null : draft?.preset === preset.key;
              return (
                <li key={preset.key}>
                  <button
                    type="button"
                    onClick={() => (preset.key === '' ? setDraft(null) : pickPreset(preset.key))}
                    className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left hover:bg-accent"
                  >
                    <span
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-full border border-foreground/30',
                        picked && 'border-[5px] border-blue-600',
                      )}
                    />
                    {preset.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap gap-6">
              {month(0)}
              {month(1)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium">
                {draft === null ? 'Maximum' : (presetLabel(draft.preset) ?? 'Custom')}
              </span>
              <Input
                type="date"
                aria-label="From"
                className="w-40"
                value={draft?.from ?? ''}
                max={draft?.to ?? undefined}
                onChange={(e) => {
                  const from = e.target.value;
                  if (!from) return;
                  setDraft((current) => ({
                    preset: 'custom',
                    from,
                    to: current?.to && current.to >= from ? current.to : from,
                  }));
                }}
              />
              <span className="text-xs text-foreground/50">–</span>
              <Input
                type="date"
                aria-label="To"
                className="w-40"
                value={draft?.to ?? ''}
                min={draft?.from}
                onChange={(e) => {
                  const to = e.target.value;
                  if (!to) return;
                  setDraft((current) => ({
                    preset: 'custom',
                    from: current && current.from <= to ? current.from : to,
                    to,
                  }));
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-foreground/50">By the day the candidate was added to the pipeline</p>
              <div className="flex gap-2">
                {/* empties what is picked in the calendar; Update after it leaves the board unfiltered by date */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={draft === null}
                  onClick={() => setDraft(null)}
                  data-testid="date-range-clear"
                >
                  <Eraser className="mr-1.5 h-4 w-4" />
                  Clear
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={apply} data-testid="date-range-update">
                  Update
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
