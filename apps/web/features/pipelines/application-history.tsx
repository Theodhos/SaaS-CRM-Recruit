'use client';

import { Badge, cn } from '@crm/ui';
import { ArrowDown, ArrowRight, Briefcase, CalendarClock, ChevronRight, ExternalLink, FileUp, GitBranch, NotebookPen, UserPlus, Video } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState, type ReactNode } from 'react';

import { DocumentPreviewDialog, type PreviewableDocument } from '@/features/documents/document-preview-dialog';
import { useStageNotes } from '@/hooks/use-stage-notes';
import type { ApplicationWithRelations } from '@/services/applications.service';
import type { CalendarEventWithRelations } from '@/services/calendar.service';
import type { DocumentWithRelations } from '@/services/documents.service';
import type { Interview } from '@/services/interviews.service';
import type { PlacementWithRelations } from '@/services/placements.service';

import { TONES, stageColors, type ToneClasses } from './stage-colors';
import { stageForm } from './stage-forms';
import { stageHistory } from './stage-history-text';

const when = (value: string | number | Date | null | undefined) =>
  value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const timeOf = (value: number) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayOf = (value: number) => new Date(value).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const words = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const money = (value: number | null, currency: string) =>
  value === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
/** "scheduledDate" -> "Scheduled date", for a recorded field the stage's form does not name. */
const fieldName = (key: string) => {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
const isLink = (value: unknown): value is string => typeof value === 'string' && /^https?:\/\//i.test(value);

/** One thing that happened, on the timeline. */
export interface HistoryItem {
  key: string;
  at: number;
  tone: ToneClasses;
  icon: ReactNode;
  title: ReactNode;
  /** Who did it, in small print next to the time. */
  by?: string | null;
  body?: ReactNode;
  /** Where a click on the item goes: the place in the platform it is about (the card in the pipeline, the calendar…). */
  href?: string;
  /** For an uploaded file: a click opens it here, in the preview. */
  document?: PreviewableDocument;
  /** More places to go from the item, as small buttons under it (Join link, Download…). */
  actions?: { label: string; href: string; external?: boolean }[];
}

/**
 * The timeline itself: grouped by day, the rail on the left (the kind of event in the stage's colour, a line, the
 * arrow down to what happened next), what happened on the right with its time. An item that is about a place in the
 * platform is a link to it — the whole row — and a file opens in the preview; other links sit under it as buttons.
 */
export function HistoryTimeline({ items, empty }: { items: HistoryItem[]; empty: string }) {
  const [previewing, setPreviewing] = useState<PreviewableDocument | null>(null);
  if (items.length === 0) return <p className="py-2 text-xs text-foreground/50">{empty}</p>;
  const ordered = [...items].sort((a, b) => a.at - b.at);

  return (
    <>
      <ol className="flex flex-col" data-testid="history-timeline">
        {ordered.map((item, index) => {
          const newDay = index === 0 || dayOf(ordered[index - 1]!.at) !== dayOf(item.at);
          const clickable = Boolean(item.href || item.document);
          const card = (
            <div
              className={cn(
                'rounded-md border border-l-4 border-border px-3 py-2 text-sm',
                item.tone.soft,
                item.tone.edge,
                clickable && 'transition-shadow group-hover:shadow-md group-hover:ring-1 group-hover:ring-foreground/20',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium">{item.title}</p>
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-foreground/60">
                  {timeOf(item.at)}
                  {clickable ? <ChevronRight className="h-3.5 w-3.5 text-foreground/40 group-hover:text-foreground" /> : null}
                </span>
              </div>
              {item.by ? <p className="text-[11px] text-foreground/50">by {item.by}</p> : null}
              {item.body ? <div className="mt-1.5">{item.body}</div> : null}
            </div>
          );
          return (
            <Fragment key={item.key}>
              {newDay ? (
                <li className="mb-2 mt-1 flex items-center gap-2 first:mt-0" data-testid="history-day">
                  <span className="rounded-full bg-foreground/80 px-2.5 py-0.5 text-[11px] font-semibold text-background">{dayOf(item.at)}</span>
                  <span className="h-px flex-1 bg-border" />
                </li>
              ) : null}
              <li className="flex items-stretch gap-2.5" data-testid="history-item">
                <span className="flex w-7 shrink-0 flex-col items-center pt-1" aria-hidden>
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm', item.tone.solid)}>{item.icon}</span>
                  {index < ordered.length - 1 ? (
                    <>
                      <span className="w-px flex-1 bg-foreground/20" />
                      <ArrowDown className="h-4 w-4 shrink-0 text-foreground/50" />
                    </>
                  ) : null}
                </span>
                <div className="min-w-0 flex-1 pb-2.5">
                  {item.href ? (
                    <Link href={item.href} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="history-link">
                      {card}
                    </Link>
                  ) : item.document ? (
                    <button
                      type="button"
                      className="group block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Open the document"
                      data-testid="history-document"
                      onClick={() => setPreviewing(item.document!)}
                    >
                      {card}
                    </button>
                  ) : (
                    card
                  )}
                  {item.actions && item.actions.length > 0 ? (
                    <p className="mt-1.5 flex flex-wrap gap-2">
                      {item.actions.map((action) =>
                        action.external ? (
                          <a
                            key={action.label}
                            href={action.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                            data-testid="history-action"
                          >
                            <ExternalLink className="h-3 w-3" /> {action.label}
                          </a>
                        ) : (
                          <Link
                            key={action.label}
                            href={action.href}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                            data-testid="history-action"
                          >
                            <ChevronRight className="h-3 w-3" /> {action.label}
                          </Link>
                        ),
                      )}
                    </p>
                  ) : null}
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
      {previewing ? <DocumentPreviewDialog document={previewing} onClose={() => setPreviewing(null)} /> : null}
    </>
  );
}

const ICON = 'h-3.5 w-3.5';

/** A document that was uploaded, as a timeline item: a click opens it. */
export function documentItem(document: DocumentWithRelations): HistoryItem {
  return {
    key: `document-${document.id}`,
    at: new Date(document.createdAt).getTime(),
    tone: TONES.slate,
    icon: <FileUp className={ICON} />,
    title: (
      <>
        Document uploaded: <span className="underline decoration-dotted underline-offset-2">{document.name}</span>{' '}
        <span className="font-normal text-foreground/60">({words(String(document.type))})</span>
      </>
    ),
    by: document.uploadedBy ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}` : null,
    document: { id: document.id, name: document.name, downloadUrl: document.downloadUrl },
  };
}

/** A meeting put on the calendar, as a timeline item: a click opens it in the calendar. */
export function meetingItem(event: CalendarEventWithRelations): HistoryItem {
  return {
    key: `meeting-${event.id}`,
    at: new Date(event.createdAt).getTime(),
    tone: event.status === 'CANCELLED' ? TONES.red : TONES.blue,
    icon: <CalendarClock className={ICON} />,
    title: (
      <>
        {event.status === 'CANCELLED' ? 'Meeting cancelled' : 'Meeting scheduled'}: {event.title}
      </>
    ),
    by: event.user ? `${event.user.firstName} ${event.user.lastName}` : null,
    body: (
      <p className="text-xs text-foreground/70">
        {words(String(event.type))} · {when(event.startAt)}
        {event.location ? ` · ${event.location}` : ''}
      </p>
    ),
    href: `/calendar?eventId=${event.id}`,
    actions: isLink(event.meetingUrl) ? [{ label: 'Join link', href: event.meetingUrl, external: true }] : undefined,
  };
}

/**
 * Everything that happened to a candidate for ONE job, oldest first: when they applied, every move from stage to
 * stage on the board (each one, also the returns), what was written and recorded at each stage (notes, the stage's
 * own fields, the pay), the Zoom interviews and meetings set up, the documents uploaded for this job, the hiring and
 * how the contract ended. Read-only — but every row leads to where it happened: the card in the pipeline, the
 * calendar, the file, Active Employees / Completed Contract.
 */
export function ApplicationHistory({
  application,
  documents,
  interviews,
  meetings,
  placement,
}: {
  application: ApplicationWithRelations;
  /** The candidate's documents that belong to this job. */
  documents: DocumentWithRelations[];
  /** The Zoom interviews scheduled for this application. */
  interviews: Interview[];
  /** The calendar entries of this job (the ones a Zoom interview created are left out by the caller). */
  meetings: CalendarEventWithRelations[];
  /** The Active Employees entry for this job, if the candidate was hired. */
  placement?: PlacementWithRelations;
}) {
  const { data, isLoading } = useStageNotes(application.id);
  if (isLoading || !data) return <p className="py-2 text-xs text-foreground/50">Loading…</p>;

  // the card of this application, opened in the pipeline
  const inPipeline = `/pipeline?pipelineId=${application.pipelineId}&candidateId=${application.candidate.id}&open=${application.id}`;
  const stageOf = (id: string | null) => data.stages.find((s) => s.stage.id === id)?.stage ?? null;
  const badge = (id: string | null) => {
    const stage = stageOf(id);
    return stage ? <Badge variant={stageColors(stage).badge}>{stage.name}</Badge> : <span className="text-foreground/50">another stage</span>;
  };
  const toneOf = (id: string | null) => {
    const stage = stageOf(id);
    return stage ? stageColors(stage) : TONES.slate;
  };
  const items: HistoryItem[] = [];

  // ---- applying, and every move on the board ----
  if (!data.moves.some((move) => move.kind === 'added')) {
    items.push({ key: 'applied', at: new Date(application.appliedAt ?? data.startedAt).getTime(), tone: TONES.blue, icon: <UserPlus className={ICON} />, title: 'Applied for this job', href: inPipeline });
  }
  data.moves.forEach((move, index) => {
    const base = { key: `move-${index}`, at: new Date(move.at).getTime(), by: move.by, href: inPipeline };
    if (move.kind === 'added') {
      items.push({ ...base, tone: move.toStageId ? toneOf(move.toStageId) : TONES.blue, icon: <UserPlus className={ICON} />, title: <>Applied for this job{stageOf(move.toStageId) ? <> — put in {badge(move.toStageId)}</> : null}</> });
    } else if (move.kind === 'moved') {
      items.push({
        ...base,
        tone: toneOf(move.toStageId),
        icon: <GitBranch className={ICON} />,
        title: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Moved {badge(move.fromStageId)} <ArrowRight className="h-3.5 w-3.5 text-foreground/50" /> {badge(move.toStageId)}
          </span>
        ),
      });
    } else if (move.kind === 'reopened') {
      items.push({ ...base, tone: toneOf(move.toStageId), icon: <GitBranch className={ICON} />, title: <>Reconsidered — back in {badge(move.toStageId)}</> });
    } else if (move.kind === 'removed') {
      items.push({ ...base, href: undefined, tone: TONES.red, icon: <GitBranch className={ICON} />, title: 'Removed from the pipeline' });
    } else {
      items.push({ ...base, tone: TONES.green, icon: <GitBranch className={ICON} />, title: 'Put back on the pipeline' });
    }
  });

  // ---- what was written and recorded at each stage ----
  const history = stageHistory(data.stages, data.currentStageId);
  const textOf = (stageId: string) =>
    stageId === data.currentStageId ? history.own : (history.earlier.find((earlier) => earlier.stageId === stageId)?.text ?? '');
  for (const { stage, note } of data.stages) {
    if (!note) continue;
    const text = textOf(stage.id);
    const form = stageForm(stage);
    const fields = Object.entries(note.fields ?? {}).filter(([, value]) => value !== null && value !== '' && value !== false && value !== undefined);
    const hasPay = note.hourlyRate !== null && note.hourlyRate !== undefined;
    if (!text && fields.length === 0 && !hasPay) continue;
    // a recorded meeting link is a place to go: it gets its own button rather than sitting in the text
    const links = fields.filter(([, value]) => isLink(value));
    items.push({
      key: `note-${stage.id}`,
      at: new Date(note.updatedAt).getTime(),
      tone: stageColors(stage),
      icon: <NotebookPen className={ICON} />,
      title: <>Recorded at {badge(stage.id)}</>,
      href: inPipeline,
      actions: links.map(([key, value]) => ({ label: form.fields.find((field) => field.key === key)?.label ?? fieldName(key), href: String(value), external: true })),
      body: (
        <>
          {text ? <p className="whitespace-pre-wrap rounded bg-background/70 px-2 py-1.5">{text}</p> : null}
          {fields.length > links.length ? (
            <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
              {fields
                .filter(([, value]) => !isLink(value))
                .map(([key, value]) => (
                  <div key={key} className="flex gap-1">
                    <dt className="text-foreground/50">{form.fields.find((field) => field.key === key)?.label ?? fieldName(key)}:</dt>
                    <dd className="break-words font-medium">{value === true ? 'Yes' : String(value)}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {hasPay ? (
            <p className="mt-1.5 text-xs text-foreground/70">
              Pay: <span className="font-medium text-foreground">{money(note.hourlyRate, note.currency)}/h</span> · {money(note.perDay, note.currency)}/day ·{' '}
              {money(note.perMonth, note.currency)}/month
              {note.feePercent !== null ? ` · fee ${note.feePercent}% = ${money(note.feePerMonth, note.currency)}` : ''}
            </p>
          ) : null}
        </>
      ),
    });
  }

  // ---- interviews, meetings, documents ----
  for (const interview of interviews) {
    items.push({
      key: `interview-${interview.id}`,
      at: new Date(interview.createdAt).getTime(),
      tone: TONES.orange,
      icon: <Video className={ICON} />,
      title: 'Zoom interview scheduled',
      by: interview.interviewer ? `${interview.interviewer.firstName} ${interview.interviewer.lastName}` : null,
      href: inPipeline,
      actions: [
        ...(isLink(interview.meetingUrl) ? [{ label: 'Join link', href: interview.meetingUrl, external: true }] : []),
        ...(isLink(interview.hostUrl) ? [{ label: 'Start as host', href: interview.hostUrl, external: true }] : []),
        { label: 'Open the calendar', href: '/calendar' },
      ],
      body: (
        <p className="text-xs text-foreground/70">
          For {when(interview.scheduledAt)} · {interview.duration} min · {interview.inviteSentAt ? `invitation sent to ${interview.inviteSentTo}` : 'invitation not sent'}
        </p>
      ),
    });
  }
  items.push(...meetings.map(meetingItem), ...documents.map(documentItem));

  // ---- hired, and how the contract ended ----
  if (placement) {
    items.push({
      key: `placement-${placement.id}`,
      at: new Date(placement.createdAt).getTime(),
      tone: TONES.green,
      icon: <Briefcase className={ICON} />,
      title: <>Hired{placement.employmentType ? ` as ${words(placement.employmentType)}` : ''}</>,
      body: <p className="text-xs text-foreground/70">Start date {new Date(placement.startDate).toLocaleDateString()}</p>,
      // the list this entry is on now
      href: placement.status === 'ACTIVE' ? '/applications' : '/completed-contracts',
    });
    if (placement.status !== 'ACTIVE') {
      items.push({
        key: `placement-end-${placement.id}`,
        // the end date is a day without a time: the moment the entry was last changed says when it was done
        at: new Date(placement.updatedAt).getTime(),
        tone: placement.status === 'COMPLETED' ? TONES.slate : TONES.red,
        icon: <Briefcase className={ICON} />,
        title: placement.status === 'COMPLETED' ? 'Contract completed' : 'Contract terminated',
        body: placement.endDate ? <p className="text-xs text-foreground/70">End date {new Date(placement.endDate).toLocaleDateString()}</p> : undefined,
        href: '/completed-contracts',
      });
    }
  }

  return <HistoryTimeline items={items} empty="Nothing has happened for this job yet." />;
}
