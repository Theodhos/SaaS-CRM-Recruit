'use client';

import { Button, Dialog, Input } from '@crm/ui';
import type { CreateCalendarEventInput } from '@crm/validation';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { EventForm, MonthView } from '@/features/calendar';
import {
  useCalendarEvent,
  useCalendarEvents,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '@/hooks/use-calendar';
import { toFormDefaults } from '@/lib/form-defaults';
import type { CalendarEventWithRelations } from '@/services/calendar.service';

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// `useSearchParams()` must sit under a Suspense boundary so the route can be
// statically prerendered (Next 14 fails `next build` otherwise). Rendering is
// unchanged: the page body still renders client-side after hydration.
export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkEventId = searchParams.get('eventId');

  const [cursor, setCursor] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [dialogState, setDialogState] = useState<
    { mode: 'create' | 'edit'; event?: CalendarEventWithRelations; defaultDate?: Date; candidateId?: string } | null
  >(null);

  // "Schedule a meeting" from a pipeline card: the form opens with that candidate already chosen.
  const forCandidateId = searchParams.get('new') ? searchParams.get('candidateId') : null;
  useEffect(() => {
    if (!forCandidateId) return;
    setDialogState({ mode: 'create', defaultDate: new Date(), candidateId: forCandidateId });
    router.replace('/calendar', { scroll: false });
  }, [forCandidateId, router]);

  // Arriving from a notification's reminder/scheduled link — jump straight
  // to that event's month and open it, instead of making them scroll to find it.
  const { data: deepLinkEvent } = useCalendarEvent(deepLinkEventId ?? undefined);
  useEffect(() => {
    if (deepLinkEvent) {
      setCursor(new Date(deepLinkEvent.startAt));
      setDialogState({ mode: 'edit', event: deepLinkEvent });
      router.replace('/calendar', { scroll: false });
    }
  }, [deepLinkEvent, router]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const { gridStart, gridEnd } = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstOfMonth.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 42);
    return { gridStart: start, gridEnd: end };
  }, [year, month]);

  const { data, isLoading } = useCalendarEvents({
    from: gridStart.toISOString(),
    to: gridEnd.toISOString(),
    search: search || undefined,
    pageSize: 100,
  });
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  async function handleSubmit(values: CreateCalendarEventInput) {
    if (dialogState?.mode === 'edit' && dialogState.event) {
      await updateEvent.mutateAsync({ id: dialogState.event.id, input: values });
    } else {
      await createEvent.mutateAsync(values);
    }
    setDialogState(null);
  }

  function handleDelete() {
    if (dialogState?.mode === 'edit' && dialogState.event) {
      if (window.confirm(`Delete "${dialogState.event.title}"?`)) {
        deleteEvent.mutate(dialogState.event.id);
        setDialogState(null);
      }
    }
  }

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Calendar</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Interviews, meetings, and calls — click a day to schedule one, or an event to edit it. A meeting with a link, for a candidate, also shows on their
            pipeline card.
          </p>
        </div>
        <Button type="button" onClick={() => setDialogState({ mode: 'create', defaultDate: new Date() })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Meeting
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold">{monthLabel}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search events…"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>
      ) : (
        <MonthView
          year={year}
          month={month}
          events={data?.items ?? []}
          onSelectDay={(date) => setDialogState({ mode: 'create', defaultDate: date })}
          onSelectEvent={(event) => setDialogState({ mode: 'edit', event })}
        />
      )}

      {dialogState ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          title={dialogState.mode === 'edit' ? 'Edit meeting' : 'Add meeting'}
        >
          <div className="flex flex-col gap-4">
            {dialogState.mode === 'edit' && /^https?:\/\//i.test(dialogState.event?.meetingUrl ?? '') ? (
              <a
                href={dialogState.event?.meetingUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                data-testid="event-join"
                className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" /> Join meeting
              </a>
            ) : null}
            <EventForm
              defaultValues={
                dialogState.mode === 'edit' && dialogState.event
                  ? {
                      ...toFormDefaults(dialogState.event),
                      startAt: toLocalInputValue(new Date(dialogState.event.startAt)),
                      endAt: toLocalInputValue(new Date(dialogState.event.endAt)),
                    }
                  : dialogState.defaultDate
                    ? {
                        startAt: toLocalInputValue(
                          new Date(dialogState.defaultDate.setHours(9, 0, 0, 0)),
                        ),
                        endAt: toLocalInputValue(new Date(dialogState.defaultDate.setHours(9, 30, 0, 0))),
                        ...(dialogState.candidateId ? { candidateId: dialogState.candidateId } : {}),
                      }
                    : undefined
              }
              submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create meeting'}
              onSubmit={handleSubmit}
            />
            {dialogState.mode === 'edit' ? (
              <Button type="button" variant="outline" onClick={handleDelete}>
                Delete event
              </Button>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
