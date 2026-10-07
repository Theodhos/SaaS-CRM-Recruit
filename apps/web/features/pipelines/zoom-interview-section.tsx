'use client';

import { Button, Input, Label, Select, Textarea } from '@crm/ui';
import { Copy, ExternalLink, Mail, Video } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useCalendarEvents } from '@/hooks/use-calendar';
import { useInterviewCapabilities, useInterviews, useResendInterviewInvite, useScheduleInterview } from '@/hooks/use-interviews';
import type { ApplicationWithRelations } from '@/services/applications.service';
import type { CalendarEventWithRelations } from '@/services/calendar.service';
import type { ScheduleInterviewResult } from '@/services/interviews.service';

const minutesBetween = (event: CalendarEventWithRelations) =>
  Math.max(1, Math.round((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60_000));

const DURATIONS = ['30', '45', '60', '90'] as const;

/** Tomorrow at 10:00 local time, as a datetime-local value. */
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * From a pipeline card, at any stage: create a Zoom link for a slot and e-mail the invitation to the address the
 * candidate gave. The meeting is always created by the platform itself, through the Zoom API — a link is never
 * typed or pasted in; until Zoom is connected (Settings → Integrations) nothing can be created here. Every interview scheduled for this applicant is listed with its links and delivery status —
 * together with the meetings put on the calendar for this candidate, marked "From the calendar", so a link made
 * either way shows in one place. `withMessage={false}` leaves out the free-text message of the invitation.
 */
export function ZoomInterviewSection({ application, withMessage = true }: { application: ApplicationWithRelations; withMessage?: boolean }) {
  const { data: caps } = useInterviewCapabilities();
  const { data: interviews } = useInterviews(application.id);
  const schedule = useScheduleInterview(application.id);
  const resend = useResendInterviewInvite(application.id);

  // A meeting put on the calendar for this candidate, with a link, belongs here too — it is the same thing, reached
  // the other way round. The ones the calendar holds for an interview scheduled below are left out: they are the
  // rows underneath already.
  const { data: calendar } = useCalendarEvents({ candidateId: application.candidate.id, pageSize: 100 });
  const meetings = useMemo(
    () =>
      (calendar?.items ?? [])
        .filter((event) => /^https?:\/\//i.test(event.meetingUrl?.trim() ?? '') && event.status !== 'CANCELLED' && !event.application)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [calendar],
  );

  const [slot, setSlot] = useState(defaultSlot);
  const [duration, setDuration] = useState<string>('45');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ScheduleInterviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const email = application.candidate.email;
  const zoomAuto = caps?.zoomConfigured ?? false;
  const canSubmit = Boolean(slot) && zoomAuto && !schedule.isPending;

  async function submit() {
    setError(null);
    setResult(null);
    try {
      const res = await schedule.mutateAsync({
        applicationId: application.id,
        scheduledAt: new Date(slot).toISOString(),
        durationMinutes: Number(duration),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: message.trim() || undefined,
        sendInvite: Boolean(email),
      });
      setResult(res);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule the interview.');
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is visible to select */
    }
  }

  return (
    <div className="rounded-lg border border-border p-3" data-testid="zoom-interview">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Video className="h-4 w-4 text-foreground/50" /> Zoom interview
        </h4>
        <Link
          href={`/calendar?candidateId=${application.candidate.id}&new=1`}
          className="text-xs font-medium text-primary hover:underline"
          data-testid="schedule-meeting"
        >
          Schedule in the calendar
        </Link>
      </div>
      {zoomAuto || !caps ? (
        <p className="mb-3 text-xs text-foreground/50">
          The platform creates the Zoom meeting for the slot itself and e-mails the invitation to the candidate.
        </p>
      ) : (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900" data-testid="zoom-not-connected">
          Zoom is not connected to the platform yet, so a meeting cannot be created. An administrator connects it once
          (Settings → Integrations → Zoom); after that every meeting is created here with one click.
        </p>
      )}

      {meetings.length > 0 || (interviews?.length ?? 0) > 0 ? (
        <ul className="mb-3 flex flex-col divide-y divide-border rounded-md border border-border text-xs" data-testid="zoom-interview-list">
          {meetings.map((event) => (
            <li key={`calendar-${event.id}`} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2" data-testid="calendar-meeting">
              <div>
                <p className="font-medium">
                  {new Date(event.startAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {minutesBetween(event)} min
                </p>
                <p className="text-foreground/50">
                  {event.title} · From the calendar
                  {event.user ? ` · ${event.user.firstName} ${event.user.lastName}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={event.meetingUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Join link
                </a>
                <Link href={`/calendar?eventId=${event.id}`} className="text-foreground/60 hover:underline">
                  Open in calendar
                </Link>
              </div>
            </li>
          ))}
          {interviews?.map((interview) => (
            <li key={interview.id} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
              <div>
                <p className="font-medium">
                  {new Date(interview.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {interview.duration} min
                </p>
                <p className="text-foreground/50">
                  {interview.inviteSentAt ? `Invitation sent to ${interview.inviteSentTo}` : 'Invitation not sent'}
                  {interview.interviewer ? ` · ${interview.interviewer.firstName} ${interview.interviewer.lastName}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {interview.meetingUrl ? (
                  <a href={interview.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Join link
                  </a>
                ) : null}
                {interview.hostUrl ? (
                  <a href={interview.hostUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Start as host
                  </a>
                ) : null}
                {email ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={resend.isPending}
                    onClick={() =>
                      resend.mutate(interview.id, {
                        onSuccess: (res) => {
                          setError(null);
                          setResult(res);
                        },
                        onError: (e) => setError(e.message),
                      })
                    }
                  >
                    <Mail className="mr-1 h-3 w-3" /> {interview.inviteSentAt ? 'Resend' : 'Send invitation'}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="interview-slot">Date &amp; time</Label>
          <Input id="interview-slot" type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="interview-duration">Duration</Label>
          <Select id="interview-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Send to</Label>
          <p className="truncate rounded-md border border-border bg-accent/30 px-2 py-2 text-xs" title={email ?? ''}>
            {email ?? 'No e-mail on file'}
          </p>
        </div>
        {withMessage ? (
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
            <Label htmlFor="interview-message">Message in the invitation (optional)</Label>
            <Textarea
              id="interview-message"
              rows={2}
              className="min-h-0"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Agenda, who they will meet, what to prepare…"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground/50">
          {caps && !caps.emailConfigured ? 'E-mail sending is not configured on the API yet — the link is created and shown here to share.' : ''}
        </p>
        <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
          {schedule.isPending ? 'Scheduling…' : email ? 'Create Zoom meeting & e-mail invitation' : 'Create Zoom meeting'}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="mt-3 rounded-md bg-accent/40 p-3 text-xs" data-testid="interview-result">
          <p className="font-medium">{result.email.sent ? `Invitation sent to ${result.email.to}` : (result.email.error ?? 'Interview scheduled')}</p>
          {result.interview.meetingUrl ? (
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <a className="break-all text-primary underline" href={result.interview.meetingUrl} target="_blank" rel="noreferrer">
                {result.interview.meetingUrl}
              </a>
              <Button type="button" size="sm" onClick={() => void copy(result.interview.meetingUrl!)}>
                <Copy className="mr-1 h-3 w-3" /> {copied ? 'Copied' : 'Copy link'}
              </Button>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
