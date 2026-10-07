'use client';

import { cn } from '@crm/ui';
import { Video } from 'lucide-react';

import type { CalendarEventWithRelations } from '@/services/calendar.service';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_DOT: Record<CalendarEventWithRelations['type'], string> = {
  MEETING: 'bg-[var(--chart-series-1)]',
  INTERVIEW: 'bg-[var(--chart-series-2)]',
  CALL: 'bg-[var(--chart-series-3)]',
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** A plain CSS-grid month view — no calendar library, just 42 day cells (6 weeks) so the grid never reflows between months. */
export function MonthView({
  year,
  month,
  events,
  onSelectDay,
  onSelectEvent,
}: {
  year: number;
  month: number;
  events: CalendarEventWithRelations[];
  onSelectDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEventWithRelations) => void;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const today = new Date();

  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return date;
  });

  const eventsByDay = new Map<string, CalendarEventWithRelations[]>();
  for (const event of events) {
    const key = new Date(event.startAt).toDateString();
    const list = eventsByDay.get(key) ?? [];
    list.push(event);
    eventsByDay.set(key, list);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="grid grid-cols-7 border-b border-border bg-accent/40 text-xs font-medium uppercase tracking-wide text-foreground/60">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2 text-center">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          const dayEvents = eventsByDay.get(date.toDateString()) ?? [];
          const inMonth = date.getMonth() === month;
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDay(date)}
              className={cn(
                'flex min-h-24 flex-col gap-1 border-b border-r border-border p-1.5 text-left align-top',
                i % 7 === 6 ? 'border-r-0' : '',
                !inMonth ? 'bg-accent/10 text-foreground/30' : '',
                'hover:bg-accent/30',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  isSameDay(date, today) ? 'bg-primary font-semibold text-primary-foreground' : '',
                )}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    className="flex items-center gap-1 truncate rounded bg-accent px-1 py-0.5 text-[11px] hover:bg-accent/70"
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TYPE_DOT[event.type])} />
                    {event.meetingUrl ? <Video className="h-3 w-3 shrink-0 text-sky-700" aria-label="has a meeting link" /> : null}
                    <span className="truncate">
                      {new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {event.title}
                    </span>
                  </span>
                ))}
                {overflow > 0 ? <span className="text-[11px] text-foreground/50">+{overflow} more</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
