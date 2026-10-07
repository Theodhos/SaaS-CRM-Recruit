'use client';

import { Video } from 'lucide-react';
import { useMemo } from 'react';

import { useCalendarEvents } from '@/hooks/use-calendar';
import type { CalendarEventWithRelations } from '@/services/calendar.service';

/** A calendar entry counts as a meeting of the candidate when it has a link and was not cancelled. */
const isMeeting = (event: CalendarEventWithRelations) => /^https?:\/\//i.test(event.meetingUrl?.trim() ?? '') && event.status !== 'CANCELLED';

/**
 * The next meeting with a link of every candidate, from the calendar — for the chips on the pipeline's cards. One
 * request for the whole board.
 */
export function useNextMeetings() {
  // from the start of today, so a meeting that began an hour ago is still on the card
  const from = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }, []);
  const { data } = useCalendarEvents({ from, pageSize: 100 });
  return useMemo(() => {
    const next = new Map<string, CalendarEventWithRelations>();
    for (const event of [...(data?.items ?? [])].filter(isMeeting).sort((a, b) => a.startAt.localeCompare(b.startAt))) {
      if (event.candidate && !next.has(event.candidate.id)) next.set(event.candidate.id, event);
    }
    return next;
  }, [data]);
}

/** On a pipeline card: when the candidate's next meeting is, and the link to join it. */
export function MeetingBadge({ event }: { event: CalendarEventWithRelations | undefined }) {
  if (!event || !isMeeting(event)) return null;
  return (
    <a
      href={event.meetingUrl ?? undefined}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`${event.title} — join the meeting`}
      data-testid="card-meeting"
      className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-sky-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-800"
    >
      <Video className="h-3 w-3 shrink-0" />
      <span className="truncate">{new Date(event.startAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · Join</span>
    </a>
  );
}
