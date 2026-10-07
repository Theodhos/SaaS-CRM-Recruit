'use client';

import { Button, Dialog, Input, Label, Textarea } from '@crm/ui';
import { useState } from 'react';

import { useInterviewCapabilities, useScheduleInterview } from '@/hooks/use-interviews';

export interface StageTransitionValues {
  notes: string;
  date: string;
  time: string;
  meetingLink: string;
}

/**
 * The pop-up that New, Screening and Interview open before a card actually moves:
 *  - "schedule" (Screening, Interview): notes + date/time, all optional — the card moves to the target stage
 *    whether or not any of them are filled in. With a date and a time the platform creates the Zoom meeting for
 *    that slot itself (and e-mails the candidate); a meeting link is never typed in. Re-opening it pre-fills whatever was last recorded
 *    for this candidate (its own stage if it has one, otherwise the latest of any other stage), editable before
 *    confirming.
 *  - "notes" (Reject, every stage): only notes, and it is required — Confirm stays disabled and the card does
 *    not move to Rejected until something is written.
 */
export function StageTransitionDialog({
  label,
  action,
  notesPlaceholder,
  mode,
  applicationId,
  inviteByEmail,
  initialValues,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  label: string;
  /** The pop-up's title and confirm button when "Move to <label>" does not say it — e.g. "Terminate the contract". */
  action?: string;
  /** For "notes": what the notes box asks for instead of a rejection reason. */
  notesPlaceholder?: string;
  mode: 'schedule' | 'notes';
  /** The card being moved — the Zoom meeting of a "schedule" pop-up is created for it. */
  applicationId: string;
  /** The candidate has an e-mail address: the invitation with the link is sent to it. */
  inviteByEmail: boolean;
  initialValues?: StageTransitionValues & { from: string | null };
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (values: StageTransitionValues) => void;
}) {
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [date, setDate] = useState(initialValues?.date ?? '');
  const [time, setTime] = useState(initialValues?.time ?? '');
  const [touched, setTouched] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const { data: caps } = useInterviewCapabilities();
  const createMeeting = useScheduleInterview(applicationId);

  const zoomConnected = caps?.zoomConfigured ?? false;
  const keptLink = initialValues?.meetingLink ?? '';
  // a meeting is created for a slot that is new: re-confirming an unchanged slot keeps the meeting it already has
  const slotChanged = date !== (initialValues?.date ?? '') || time !== (initialValues?.time ?? '');
  const createsMeeting = mode === 'schedule' && zoomConnected && Boolean(date && time) && (slotChanged || !keptLink);
  const busy = pending || createMeeting.isPending;

  async function confirm() {
    setTouched(true);
    if (invalid) return;
    setMeetingError(null);
    let meetingLink = slotChanged ? '' : keptLink;
    if (createsMeeting) {
      try {
        const created = await createMeeting.mutateAsync({
          applicationId,
          scheduledAt: new Date(`${date}T${time}`).toISOString(),
          durationMinutes: 45,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sendInvite: inviteByEmail,
        });
        meetingLink = created.interview.meetingUrl ?? '';
      } catch (e) {
        // nothing moves without the meeting it was asked for
        setMeetingError(e instanceof Error ? e.message : 'The Zoom meeting could not be created.');
        return;
      }
    }
    onConfirm({ notes, date, time, meetingLink });
  }

  const notesRequired = mode === 'notes';
  const invalid = notesRequired && notes.trim() === '';

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()} title={action ?? `Move to ${label}`} className="max-w-md">
      <div className="flex flex-col gap-3">
        {initialValues?.from ? (
          <p className="text-xs text-foreground/50" data-testid="transition-carried">
            Carried from {initialValues.from} — change anything before moving on.
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transition-notes">
            Notes{' '}
            {notesRequired ? <span className="text-red-600">*</span> : <span className="text-foreground/40">(optional)</span>}
          </Label>
          <Textarea
            id="transition-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={notesPlaceholder ?? (notesRequired ? 'Why this candidate was rejected…' : 'What to remember before the next stage…')}
          />
          {touched && invalid ? (
            <p className="text-xs text-red-600" role="alert">
              Notes are required{action ? '' : ` to move to ${label}`}.
            </p>
          ) : null}
        </div>
        {mode === 'schedule' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transition-date">Date (optional)</Label>
              <Input id="transition-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transition-time">Time (optional)</Label>
              <Input id="transition-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <p className="col-span-2 text-xs text-foreground/50" data-testid="transition-meeting">
              {!caps
                ? ''
                : !zoomConnected
                  ? 'Zoom is not connected to the platform yet (Settings → Integrations), so no meeting is created for this date.'
                  : createsMeeting
                    ? `The platform creates the Zoom meeting for this date and time${inviteByEmail ? ' and e-mails the link to the candidate' : ''}.`
                    : keptLink && !slotChanged
                      ? 'The Zoom meeting already created for this date and time is kept.'
                      : 'Pick a date and a time and the platform creates the Zoom meeting itself.'}
            </p>
          </div>
        ) : null}
        {(meetingError ?? error) ? (
          <p className="text-xs text-red-600" role="alert">
            {meetingError ?? error}
          </p>
        ) : null}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || invalid}
            onClick={() => void confirm()}
          >
            {createMeeting.isPending ? 'Creating the Zoom meeting…' : pending ? 'Moving…' : (action ?? `Move to ${label}`)}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
