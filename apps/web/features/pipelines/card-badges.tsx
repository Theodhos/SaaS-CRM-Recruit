'use client';

import { Badge } from '@crm/ui';
import { useMemo } from 'react';

import { usePlacements } from '@/hooks/use-placements';
import { employmentTypeColour } from '@/lib/status-colors';
import type { ApplicationStageRecord, ApplicationWithRelations } from '@/services/applications.service';

import { stageColors, type ToneBadge } from './stage-colors';

type Variant = ToneBadge | 'outline';

export interface StageStatus {
  label: string;
  variant: Variant;
  /** One short line under the badge (the reason, the client's answer…). */
  detail?: string;
  /** Shows `detail` as a coloured badge of its own instead of plain text — e.g. Rejected's "Terminated". */
  detailVariant?: Variant;
}

const text = (fields: Record<string, unknown> | undefined, key: string): string | null => {
  const v = fields?.[key];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
};

/**
 * What a card says about where the applicant stands — not the flat "ACTIVE" of the application row, but the state
 * that belongs to the stage they are in, refined by what was recorded on that stage's form:
 * New application → In screening / Screening passed → Interviewing / Ready for client → With the client / Client
 * wants to hire → Offer sent / Offer accepted → Hired, or Rejected (with the reason).
 *
 * Colour: while nothing was decided the badge wears the stage's own colour (stage-colors.ts), so a card that moves
 * to another stage changes colour; an outcome wears its meaning — green good, amber waiting, red stopped.
 */
export function stageStatus(
  stage: { name: string; type: string },
  application: { status: string },
  record: { fields: Record<string, string | number | boolean | null> } | undefined,
): StageStatus {
  if (application.status === 'ON_HOLD') return { label: 'On hold', variant: 'warning' };
  if (application.status === 'WITHDRAWN') return { label: 'Withdrawn', variant: 'destructive' };
  const f = record?.fields;
  const result = text(f, 'result');
  /** Still in progress at this stage: the stage's colour. */
  const own = stageColors(stage).badge;

  switch (stage.name.trim().toLowerCase()) {
    case 'new': {
      // Reconsider (Rejected's pop-up) marks the reopened card this way instead of "New application" —
      // it reads differently from a first try, not as a sub-detail of it
      if (text(f, 'source') === 'Reconsidered') return { label: 'Reconsidered', variant: own };
      return { label: 'New application', variant: own, detail: text(f, 'nextStep') ?? undefined };
    }
    case 'screening':
      if (result === 'Pass') return { label: 'Screening passed', variant: 'success' };
      if (result === 'Fail') return { label: 'Screening failed', variant: 'destructive' };
      if (result === 'On hold') return { label: 'Screening on hold', variant: 'warning' };
      return { label: 'In screening', variant: own };
    case 'interview': {
      // "On hold" is the only decision made at Interview itself — set by its pop-up, shown here on the card too.
      // Approved and Rejected now move the candidate on (to Offer / Rejected) rather than staying here, but a
      // `decision` of either is still read for applications recorded before that change.
      const decision = text(f, 'decision');
      if (decision === 'Approved') return { label: 'Approved', variant: 'success' };
      if (decision === 'On hold') return { label: 'On hold', variant: 'warning' };
      if (decision === 'Rejected') return { label: 'Rejected', variant: 'destructive' };
      return { label: 'Interviewing', variant: own };
    }
    case 'client interview':
      if (result === 'Wants to hire') return { label: 'Client wants to hire', variant: 'success' };
      if (result === 'Another round') return { label: 'Another client round', variant: 'warning' };
      if (result === 'Declined') return { label: 'Client declined', variant: 'destructive' };
      if (result === 'Waiting') return { label: 'Awaiting the client', variant: 'warning' };
      return { label: 'With the client', variant: own, detail: text(f, 'client') ?? undefined };
    case 'phone screening':
      if (result === 'Pass') return { label: 'Phone screen passed', variant: 'success' };
      if (result === 'Fail') return { label: 'Phone screen failed', variant: 'destructive' };
      if (result === 'On hold') return { label: 'On hold', variant: 'warning' };
      return { label: 'To phone-screen', variant: own };
    case 'trial day':
      if (result === 'Hire') return { label: 'Trial passed — hire', variant: 'success' };
      if (result === 'Another trial day') return { label: 'Another trial day', variant: 'warning' };
      if (result === 'Not hired') return { label: 'Trial failed', variant: 'destructive' };
      return { label: 'Trial day', variant: own, detail: text(f, 'trialOn') ? `On ${text(f, 'trialOn')}` : undefined };
    case 'offer': {
      const offer = text(f, 'offerStatus');
      if (offer === 'Accepted') return { label: 'Offer accepted', variant: 'success' };
      if (offer === 'Declined') return { label: 'Offer declined', variant: 'destructive' };
      if (offer === 'Negotiating') return { label: 'Negotiating', variant: 'warning' };
      if (offer === 'Sent') return { label: 'Offer sent', variant: 'warning' };
      return { label: 'Preparing offer', variant: own };
    }
    case 'completed':
      return { label: 'Contract completed', variant: own };
    default:
      break;
  }
  if (stage.type === 'PLACED') {
    // what the pop-up's Active / Terminate / Contracted buttons recorded
    const decision = text(f, 'decision');
    if (decision === 'Terminated') return { label: 'Terminated', variant: 'destructive' };
    if (decision === 'Completed') return { label: 'Contract completed', variant: 'slate' };
    return { label: 'Active', variant: 'success' };
  }
  if (stage.type === 'REJECTED') {
    const reason = text(f, 'reason');
    // Terminated (from Active Employees) is a status of its own, not free text like a regular rejection reason
    return { label: 'Rejected', variant: 'destructive', detail: reason ?? undefined, detailVariant: reason === 'Terminated' ? 'slate' : undefined };
  }
  // a custom stage: its own outcome, else its name
  const outcome = text(f, 'outcome');
  if (outcome === 'Passed') return { label: `${stage.name}: passed`, variant: 'success' };
  if (outcome === 'Failed') return { label: `${stage.name}: failed`, variant: 'destructive' };
  return { label: stage.name, variant: own };
}

export function StageStatusBadge({ application, stage }: { application: ApplicationWithRelations; stage: { name: string; type: string } }) {
  const record = application.stageNotes?.find((n) => n.pipelineStageId === application.pipelineStageId);
  const status = stageStatus(stage, application, record);
  return (
    <span className="flex flex-col items-end gap-0.5" data-testid="stage-status">
      <Badge variant={status.variant}>{status.label}</Badge>
      {status.detail ? (
        status.detailVariant ? (
          <Badge variant={status.detailVariant} className="max-w-[9rem] truncate">
            {status.detail}
          </Badge>
        ) : (
          <span className="max-w-[9rem] truncate text-[11px] text-foreground/50">{status.detail}</span>
        )
      ) : null}
    </span>
  );
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

/** The latest pay recorded on any stage of this application (stage notes come newest first). */
export function latestPay(application: ApplicationWithRelations): ApplicationStageRecord | null {
  return application.stageNotes?.find((n) => n.hourlyRate !== null && n.hourlyRate !== undefined) ?? null;
}

export function formatPay(note: ApplicationStageRecord): string {
  const rate = Number(note.hourlyRate);
  const month = rate * note.hoursPerDay * note.daysPerMonth;
  const fee = note.feePercent === null || note.feePercent === undefined ? null : Number(note.feePercent);
  return `${money(rate, note.currency)}/h · ${money(month, note.currency)}/mo${fee !== null ? ` · fee ${fee}%` : ''}`;
}

export function PayBadge({ application }: { application: ApplicationWithRelations }) {
  const pay = latestPay(application);
  if (!pay) return null;
  return (
    <p className="pl-4.5">
      <Badge variant="outline" title="Pay recorded in the stage notes">
        {formatPay(pay)}
      </Badge>
    </p>
  );
}

/**
 * Permanent/Temporary of every Active Employees entry, keyed by candidate + job — one request for the whole
 * board, the same shape as `useNextMeetings` (see candidate-meetings.tsx).
 */
export function useEmploymentTypes() {
  const { data } = usePlacements({ pageSize: 100 });
  return useMemo(() => {
    const map = new Map<string, 'PERMANENT' | 'TEMPORARY'>();
    for (const placement of data?.items ?? []) map.set(`${placement.candidateId}::${placement.jobId}`, placement.employmentType);
    return map;
  }, [data]);
}

/**
 * The one status an Active Employees card shows, in the same top-right spot every other stage's card shows
 * `StageStatusBadge`: Permanent or Temporary, inherited from Offer — not Active/Terminated/Contracted. That
 * decision is still made from inside the card (see StageNotesDialog's "placed" review); it just isn't on the
 * board itself.
 */
export function EmploymentTypeBadge({ application, employmentTypes }: { application: ApplicationWithRelations; employmentTypes: Map<string, 'PERMANENT' | 'TEMPORARY'> }) {
  const type = employmentTypes.get(`${application.candidate.id}::${application.job.id}`);
  if (!type) return null;
  // the same colours as Offer's Permanent / Temporary buttons: green for Permanent, amber for Temporary
  return (
    <span data-testid="employment-type-badge">
      <Badge variant={employmentTypeColour(type)}>{type === 'PERMANENT' ? 'Permanent' : 'Temporary'}</Badge>
    </span>
  );
}
