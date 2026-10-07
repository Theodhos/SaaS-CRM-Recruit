'use client';

import { Badge, Button, Dialog, Input, Label, Select, Textarea, cn } from '@crm/ui';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, Calculator, ClipboardList, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useDeleteApplication, useUpdateApplication } from '@/hooks/use-applications';
import { useOrganisation } from '@/hooks/use-organisation';
import { useCreatePipelineStage } from '@/hooks/use-pipelines';
import { usePlacements, useUpdatePlacement } from '@/hooks/use-placements';
import { useStageNotes, useUpsertStageNote } from '@/hooks/use-stage-notes';
import type { ApplicationWithRelations } from '@/services/applications.service';
import type { PayDefaults } from '@/services/organisation.service';
import type { StageNote } from '@/services/stage-notes.service';

import { COMPLETED_STAGE_NAME, isCompletedStage } from './completed-stage';
import { ReconsiderControl } from './reconsider-control';
import { TONES, stageColors } from './stage-colors';
import {
  stageForm,
  type StageField,
  type StageFieldValue,
  type StageFieldValues,
} from './stage-forms';
import { historyTitle, stageHistory } from './stage-history-text';
import { StageReviewPanel } from './stage-review-panel';
import { StageTransitionDialog, type StageTransitionValues } from './stage-transition-dialog';
import { noteSnapshot, placementSnapshot, pushUndo, type UndoEntry } from './undo';
import { ZoomInterviewSection } from './zoom-interview-section';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ALL', 'CHF'] as const;

/** "5 Oct 2026, 14:20" — the date and time shown on every step of History. */
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

const money = (value: number | null, currency: string) =>
  value === null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value);

interface Draft {
  notes: string;
  fields: StageFieldValues;
  hourlyRate: string;
  hoursPerDay: string;
  daysPerMonth: string;
  feePercent: string;
  currency: string;
}

type PayStart = Pick<PayDefaults, 'currency' | 'hoursPerDay' | 'daysPerMonth' | 'feePercent'>;
const PAY_START: PayStart = { currency: 'USD', hoursPerDay: 8, daysPerMonth: 21, feePercent: null };

/** Without a saved note the pay calculation starts from the organisation's defaults (Settings). */
const draftFrom = (note: StageNote | null, start: PayStart = PAY_START): Draft => ({
  notes: note?.notes ?? '',
  fields: { ...(note?.fields ?? {}) },
  hourlyRate:
    note?.hourlyRate === null || note?.hourlyRate === undefined ? '' : String(note.hourlyRate),
  hoursPerDay: String(note?.hoursPerDay ?? start.hoursPerDay),
  daysPerMonth: String(note?.daysPerMonth ?? start.daysPerMonth),
  feePercent: note
    ? note.feePercent === null || note.feePercent === undefined
      ? ''
      : String(note.feePercent)
    : start.feePercent === null
      ? ''
      : String(start.feePercent),
  currency: note?.currency ?? start.currency,
});

/** Live figures while typing — the same arithmetic the API stores (hour -> day -> month -> fee). */
function compute(draft: Draft) {
  const rate = draft.hourlyRate.trim() === '' ? null : Number(draft.hourlyRate);
  const hours = Number(draft.hoursPerDay) || 0;
  const days = Number(draft.daysPerMonth) || 0;
  const fee = draft.feePercent.trim() === '' ? null : Number(draft.feePercent);
  if (rate === null || Number.isNaN(rate))
    return { perDay: null, perMonth: null, feePerMonth: null };
  const perDay = +(rate * hours).toFixed(2);
  const perMonth = +(perDay * days).toFixed(2);
  return {
    perDay,
    perMonth,
    feePerMonth: fee === null || Number.isNaN(fee) ? null : +((perMonth * fee) / 100).toFixed(2),
  };
}

/** One input of the stage's form, by field type. */
function StageFieldInput({
  field,
  value,
  onChange,
}: {
  field: StageField;
  value: StageFieldValue | undefined;
  onChange: (value: StageFieldValue) => void;
}) {
  const id = `sf-${field.key}`;
  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          id={id}
          rows={2}
          className="min-h-0"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    case 'select':
      return (
        <Select
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      );
    case 'checkbox':
      return (
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          Yes
        </label>
      );
    case 'rating':
      return (
        <div className="flex h-9 items-center gap-1" role="radiogroup" aria-label={field.label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(value === n ? null : n)}
              className={cn(
                'h-7 w-7 rounded-md border text-xs font-medium transition-colors',
                typeof value === 'number' && value >= n
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-foreground/60 hover:bg-accent',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      );
    case 'number':
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            placeholder={field.placeholder}
          />
          {field.suffix ? (
            <span className="shrink-0 text-xs text-foreground/50">{field.suffix}</span>
          ) : null}
        </div>
      );
    case 'date':
      return (
        <Input
          id={id}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    default:
      return (
        <Input
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }
}

/**
 * Opens from a card on the pipeline board and shows the stage the applicant is in: the stage's own form (interview
 * ratings, offer terms, rejection reason…), free-text notes, the pay calculation (rate per hour -> per 8-hour day
 * -> per month, and the agency fee) and the Zoom interview. Everything is saved per application per stage.
 */
export function StageNotesDialog({
  application,
  onClose,
}: {
  application: ApplicationWithRelations;
  onClose: () => void;
}) {
  // set while the card is being taken off the pipeline: its notes must not be asked for again once it is gone
  const [removing, setRemoving] = useState(false);
  const { data, isLoading } = useStageNotes(removing ? undefined : application.id);
  const upsert = useUpsertStageNote(application.id);
  const queryClient = useQueryClient();
  // always the stage the applicant is in now: the dialog shows that stage only
  const stageId = application.pipelineStageId;
  const { data: organisation } = useOrganisation();
  const payStart = organisation?.payDefaults ?? PAY_START;
  const [draft, setDraft] = useState<Draft>(draftFrom(null));
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const selected = useMemo(
    () => data?.stages.find((s) => s.stage.id === stageId) ?? null,
    [data, stageId],
  );
  const savedFor = selected?.note;
  // The pay calculation follows the candidate from stage to stage: a stage that has none of its own yet shows the
  // latest one recorded before it, and saving there makes it that stage's own.
  const latestElsewhere = (has: (note: StageNote) => boolean) =>
    (data?.stages ?? [])
      .filter((s) => s.stage.id !== stageId && s.note && has(s.note))
      .sort(
        (a, b) => new Date(b.note!.updatedAt).getTime() - new Date(a.note!.updatedAt).getTime(),
      )[0] ?? null;
  const ownNotes = Boolean(savedFor?.notes?.trim());
  const ownPay = savedFor?.hourlyRate !== null && savedFor?.hourlyRate !== undefined;
  const carriedPay = useMemo(
    () => {
      const from = ownPay
        ? null
        : latestElsewhere((n) => n.hourlyRate !== null && n.hourlyRate !== undefined);
      return from ? { note: from.note!, from: from.stage.name } : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- latestElsewhere reads data and stageId
    [data, stageId, ownPay],
  );
  // History is the whole journey: the earlier stages' text (read until clicked) and this stage's own, typed directly
  const history = useMemo(() => stageHistory(data?.stages ?? [], stageId), [data, stageId]);
  const baselineNotes = history.own;
  /** Earlier stages whose text was clicked to be changed, by stage id — the text as it is being edited. */
  const [earlierEdits, setEarlierEdits] = useState<Record<string, string>>({});
  const changedEarlier = history.earlier.filter(
    (e) => e.stageId in earlierEdits && earlierEdits[e.stageId]!.trim() !== e.text,
  );

  /**
   * For a "schedule" pop-up (Screening / Interview target): pre-fill from that stage's own record if it already
   * has one — so re-opening it shows what was saved and lets it be changed — otherwise from the latest of any
   * stage that has a date, a time or a meeting link ("carries forward until overwritten"). Notes are the
   * exception: they are only ever the target stage's own, since History already shows every stage's text.
   */
  function getCarriedTransitionValues(
    targetStageId: string,
  ): StageTransitionValues & { from: string | null } {
    const stagesList = data?.stages ?? [];
    const hasTransitionData = (note: StageNote | null | undefined) =>
      Boolean(
        note &&
        (note.notes?.trim() ||
          note.fields?.scheduledDate ||
          note.fields?.scheduledTime ||
          note.fields?.meetingLink),
      );
    const own = stagesList.find((s) => s.stage.id === targetStageId)?.note ?? null;
    const source = hasTransitionData(own)
      ? { note: own!, from: null as string | null }
      : (() => {
          const latest = [...stagesList]
            .filter((s) => hasTransitionData(s.note))
            .sort(
              (a, b) =>
                new Date(b.note!.updatedAt).getTime() - new Date(a.note!.updatedAt).getTime(),
            )[0];
          return latest ? { note: latest.note!, from: latest.stage.name } : null;
        })();
    const f = source?.note.fields ?? {};
    return {
      notes: own?.notes ?? '',
      date: typeof f.scheduledDate === 'string' ? f.scheduledDate : '',
      time: typeof f.scheduledTime === 'string' ? f.scheduledTime : '',
      meetingLink: typeof f.meetingLink === 'string' ? f.meetingLink : '',
      from: source?.from ?? null,
    };
  }
  useEffect(() => {
    const own = draftFrom(savedFor ?? null, payStart);
    const pay = carriedPay ? draftFrom(carriedPay.note) : own;
    setDraft({
      ...own,
      notes: baselineNotes,
      hourlyRate: pay.hourlyRate,
      hoursPerDay: pay.hoursPerDay,
      daysPerMonth: pay.daysPerMonth,
      feePercent: pay.feePercent,
      currency: pay.currency,
    });
    setSavedAt(null);
    setEarlierEdits({});
  }, [stageId, savedFor, baselineNotes, carriedPay, payStart]);

  const form = selected ? stageForm(selected.stage) : null;
  // "New", "Screening" and "Interview" have no form to fill in: they show who the person is (see StageReviewPanel).
  const stageName = selected?.stage.name.trim().toLowerCase();
  const reviewStage =
    selected?.stage.type === 'PLACED'
      ? 'placed'
      : selected?.stage.type === 'REJECTED'
        ? 'rejected'
        : selected && isCompletedStage(selected.stage)
          ? 'completed'
          : stageName === 'new' ||
              stageName === 'screening' ||
              stageName === 'interview' ||
              stageName === 'offer'
            ? stageName
            : null;

  // the hired stage works on the person's Active Employees entry
  const { data: placements } = usePlacements(
    reviewStage === 'placed'
      ? { candidateId: application.candidate.id, jobId: application.job.id, pageSize: 5 }
      : { pageSize: 1 },
  );
  const placement = reviewStage === 'placed' ? (placements?.items[0] ?? null) : null;
  const updatePlacement = useUpdatePlacement();
  const deleteApplication = useDeleteApplication();
  const updateApplication = useUpdateApplication();
  const createStage = useCreatePipelineStage();
  const [editingPay, setEditingPay] = useState(false);
  const [closingOut, setClosingOut] = useState<'COMPLETED' | 'CANCELLED' | null>(null);
  /** Terminated was pressed: its pop-up asks why (mandatory) before anything happens. */
  const [terminating, setTerminating] = useState(false);
  const [closeOutError, setCloseOutError] = useState<string | null>(null);
  const [confirmingOnHold, setConfirmingOnHold] = useState(false);
  const [onHoldError, setOnHoldError] = useState<string | null>(null);

  /**
   * Neither button asks "are you sure": Completed acts at once, Terminated opens its pop-up, where writing why is
   * mandatory — that text is saved on Rejected and shown in History under "Terminated".
   *
   * Completed or Terminated, from Active Employees — the employment is over either way, so the card leaves the
   * "Active Employees" column; only the Placement itself carries on, into Completed Contract.
   *
   * Completed: the card moves to the pipeline's "Completed" stage, its last one, after Rejected (created here the
   * first time a pipeline needs it — see completed-stage.ts). From there it is removed by hand when no longer wanted.
   * Terminated: the card instead moves to this pipeline's Rejected stage, so it stays visible there — Rejected,
   * unlike Active Employees, keeps every card that reaches it rather than dropping it (see ReconsiderControl).
   *
   * The job can be missing a company (see ApplicationsService.maybeAutoPlace), in which case no Placement was ever
   * auto-created and `placement` is null — the card still moves/leaves either way, there's just nothing to carry
   * on to Completed Contract.
   */
  const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;
  /**
   * Records the card as it is now, for the board's Undo button — called before anything an action changes (see
   * undo.ts). `withPlacement` for actions that create or end the Active Employees entry.
   */
  async function captureUndo(
    label: string,
    options: { withPlacement?: boolean; kind?: UndoEntry['kind'] } = {},
  ) {
    if (!data) return;
    pushUndo({
      label,
      applicationId: application.id,
      kind: options.kind ?? 'changed',
      stageId: data.currentStageId,
      notes: Object.fromEntries(data.stages.map((s) => [s.stage.id, noteSnapshot(s.note)])),
      card: options.kind === 'removed' ? application : undefined,
      placement: options.withPlacement
        ? await placementSnapshot(application.candidate.id, application.job.id)
        : undefined,
    });
  }

  async function closeOutEmployment(outcome: 'COMPLETED' | 'CANCELLED', terminationNotes?: string) {
    const rejectedStage =
      outcome === 'CANCELLED'
        ? (data?.stages.find((s) => s.stage.type === 'REJECTED')?.stage ?? null)
        : null;
    setCloseOutError(null);
    setClosingOut(outcome);
    try {
      await captureUndo(
        `${outcome === 'COMPLETED' ? 'Completed' : 'Terminated'} the contract of ${candidateName}`,
        { withPlacement: true },
      );
      if (placement) {
        await updatePlacement.mutateAsync({
          id: placement.id,
          input: { status: outcome, endDate: new Date().toISOString().slice(0, 10) },
        });
      }
      if (outcome === 'CANCELLED' && rejectedStage) {
        await updateApplication.mutateAsync({
          id: application.id,
          input: { pipelineStageId: rejectedStage.id },
        });
        // marks the card "Terminated" under Rejected — the same spot a regular rejection reason shows (see card-badges'
        // stageStatus) — and keeps why: History shows it under "Terminated" instead of "Rejected" (see historyTitle)
        await upsert.mutateAsync({
          stageId: rejectedStage.id,
          input: { notes: terminationNotes, fields: { reason: 'Terminated' } },
        });
        await queryClient.invalidateQueries({ queryKey: ['applications'] });
      } else if (outcome === 'COMPLETED') {
        const stages = data?.stages.map((s) => s.stage) ?? [];
        const completedStage =
          stages.find(isCompletedStage) ??
          (await createStage.mutateAsync({
            pipelineId: application.pipelineId,
            name: COMPLETED_STAGE_NAME,
            order: Math.max(0, ...stages.map((s) => s.order)) + 1,
            type: 'STANDARD',
          }));
        await updateApplication.mutateAsync({
          id: application.id,
          input: { pipelineStageId: completedStage.id },
        });
        await queryClient.invalidateQueries({ queryKey: ['applications'] });
      } else {
        await deleteApplication.mutateAsync(application.id);
      }
      onClose();
    } catch (e) {
      setCloseOutError(e instanceof Error ? e.message : 'Could not close out the contract.');
    } finally {
      setClosingOut(null);
    }
  }
  const figures = compute(draft);
  const set =
    (field: keyof Omit<Draft, 'fields'>) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [field]: event.target.value }));
  const setField = (key: string, value: StageFieldValue) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }));

  async function save(fields: StageFieldValues = draft.fields) {
    // an earlier stage's text was changed in History: that stage's own notes are what is corrected
    for (const earlier of changedEarlier) {
      await upsert.mutateAsync({
        stageId: earlier.stageId,
        input: { notes: earlierEdits[earlier.stageId]!.trim() },
      });
    }
    setEarlierEdits({});
    await upsert.mutateAsync({
      stageId,
      input: {
        notes: draft.notes,
        fields,
        hourlyRate: draft.hourlyRate.trim() === '' ? null : Number(draft.hourlyRate),
        hoursPerDay: Number(draft.hoursPerDay) || 8,
        daysPerMonth: Number(draft.daysPerMonth) || 21,
        feePercent: draft.feePercent.trim() === '' ? null : Number(draft.feePercent),
        currency: draft.currency,
      },
    });
    // the cards read the stage record off the applications list (their status badge)
    await queryClient.invalidateQueries({ queryKey: ['applications'] });
    setSavedAt(Date.now());
  }

  /**
   * Interview's On hold: unlike Approved/Reject it never moves the card — it stays at Interview — but opens the
   * same optional notes/date/time/meeting-link pop-up New, Screening and Interview's own "schedule" targets use
   * (see getCarriedTransitionValues), so a follow-up can be scheduled without losing the On hold status.
   */
  async function confirmOnHold(values: StageTransitionValues) {
    setOnHoldError(null);
    try {
      await captureUndo(`Put ${candidateName} on hold`);
      const fields: StageFieldValues = { ...draft.fields, decision: 'On hold' };
      if (values.date) fields.scheduledDate = values.date;
      if (values.time) fields.scheduledTime = values.time;
      if (values.meetingLink.trim()) fields.meetingLink = values.meetingLink.trim();
      await upsert.mutateAsync({
        stageId,
        input: { notes: values.notes.trim() || draft.notes, fields },
      });
      await queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSavedAt(Date.now());
      setConfirmingOnHold(false);
    } catch (e) {
      setOnHoldError(e instanceof Error ? e.message : 'Could not save On hold.');
    }
  }

  const payForm = (idPrefix = '') => (
    <div className="rounded-lg border border-border p-3" data-testid="pay-calculation">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-foreground/50" /> Pay calculation
        </h4>
        {carriedPay ? (
          <p className="text-xs text-foreground/50">Kept from {carriedPay.from}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}hourlyRate`}>Rate / hour</Label>
          <Input
            id={`${idPrefix}hourlyRate`}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={draft.hourlyRate}
            onChange={set('hourlyRate')}
            placeholder="e.g. 25"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}currency`}>Currency</Label>
          <Select id={`${idPrefix}currency`} value={draft.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}hoursPerDay`}>Hours / day</Label>
          <Input
            id={`${idPrefix}hoursPerDay`}
            type="number"
            min={1}
            max={24}
            value={draft.hoursPerDay}
            onChange={set('hoursPerDay')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}daysPerMonth`}>Days / month</Label>
          <Input
            id={`${idPrefix}daysPerMonth`}
            type="number"
            min={1}
            max={31}
            value={draft.daysPerMonth}
            onChange={set('daysPerMonth')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}feePercent`}>Fee %</Label>
          <Input
            id={`${idPrefix}feePercent`}
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={draft.feePercent}
            onChange={set('feePercent')}
            placeholder="e.g. 15"
          />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 rounded-md bg-accent/40 p-3 text-sm">
        <div>
          <dt className="text-xs text-foreground/50">Per day ({draft.hoursPerDay || 0} h)</dt>
          <dd className="font-semibold tabular-nums" data-testid="per-day">
            {money(figures.perDay, draft.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-foreground/50">Per month ({draft.daysPerMonth || 0} days)</dt>
          <dd className="font-semibold tabular-nums" data-testid="per-month">
            {money(figures.perMonth, draft.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-foreground/50">Agency fee / month</dt>
          <dd className="font-semibold tabular-nums" data-testid="fee-month">
            {money(figures.feePerMonth, draft.currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
  const payCalculation = payForm();

  // The hired stage: the pay agreed before, as a fixed record — Edit opens the calculator.
  const paySummary = editingPay ? (
    <>
      {payCalculation}
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={() => setEditingPay(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={upsert.isPending}
          onClick={async () => {
            await save();
            setEditingPay(false);
          }}
        >
          {upsert.isPending ? 'Saving…' : 'Save pay'}
        </Button>
      </div>
    </>
  ) : (
    <div className="rounded-lg border border-border p-3" data-testid="pay-summary">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-foreground/50" /> Pay
          {carriedPay ? (
            <span className="text-xs font-normal text-foreground/50">· from {carriedPay.from}</span>
          ) : null}
        </h4>
        <Button type="button" size="sm" onClick={() => setEditingPay(true)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      </div>
      {figures.perDay === null ? (
        <p className="text-sm text-foreground/50">No pay was recorded in the earlier stages.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ['Rate / hour', money(Number(draft.hourlyRate), draft.currency)],
            ['Hours / day', draft.hoursPerDay],
            ['Days / month', draft.daysPerMonth],
            ['Fee', draft.feePercent.trim() === '' ? '—' : `${draft.feePercent} %`],
            ['Per day', money(figures.perDay, draft.currency)],
            ['Per month', money(figures.perMonth, draft.currency)],
            ['Agency fee / month', money(figures.feePerMonth, draft.currency)],
          ].map(([name, value]) => (
            <div key={name}>
              <dt className="text-xs text-foreground/50">{name}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );

  const notesDirty = draft.notes.trim() !== baselineNotes.trim() || changedEarlier.length > 0;
  const hasRecord =
    Boolean(savedFor) || notesDirty || draft.notes.trim() !== '' || draft.hourlyRate.trim() !== '';

  // The same card, in the same place, in every stage. What was written at the earlier stages comes first, each
  // under its stage in brackets and read-only until it is clicked (then it can be changed); the stage the candidate
  // is in now is the input at the bottom, writable straight away.
  const notesCard = (
    <section
      className="rounded-lg border border-border bg-background p-3 shadow-sm"
      data-testid="stage-notes"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="h-4 w-4 text-foreground/50" /> History
        </h4>
        <div className="flex items-center gap-3">
          <p className="text-xs text-foreground/50" data-testid="stage-notes-status">
            {notesDirty
              ? 'Not saved yet'
              : ownNotes && baselineNotes
                ? `Saved ${new Date(savedFor!.updatedAt).toLocaleString()}`
                : ''}
          </p>
        </div>
      </div>
      {/* however long the journey gets, History keeps its height: the earlier stages scroll inside it */}
      <div className="max-h-72 overflow-y-auto pr-1" data-testid="history-scroll">
        {history.earlier.length > 0 ? (
          <ol className="mb-1 flex flex-col" data-testid="history-earlier">
            {history.earlier.map((earlier) => {
              const tone = earlier.name === 'Terminated' ? TONES.red : stageColors(earlier.stage);
              const heading = (
                <span className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant={tone.badge}>({earlier.name})</Badge>
                  <span className="text-[11px] tabular-nums text-foreground/50">
                    {when(earlier.at)}
                  </span>
                </span>
              );
              return (
                <li key={earlier.stageId} className="flex items-stretch gap-2">
                  {/* the timeline's rail, on the left: the stage's dot, a line, and the arrow down to the next stage */}
                  <span className="flex w-5 shrink-0 flex-col items-center pt-2.5" aria-hidden>
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', tone.solid)} />
                    <span className="w-px flex-1 bg-foreground/20" />
                    <ArrowDown className="h-4 w-4 shrink-0 text-foreground/50" />
                  </span>
                  <div className="min-w-0 flex-1 pb-2">
                    {earlier.stageId in earlierEdits ? (
                      <div
                        className={cn(
                          'rounded-md border border-l-4 border-border bg-background px-2.5 py-2',
                          tone.edge,
                        )}
                      >
                        {heading}
                        <Textarea
                          id={`history-${earlier.stageId}`}
                          aria-label={`History of ${earlier.name}`}
                          rows={3}
                          className="min-h-0"
                          autoFocus
                          value={earlierEdits[earlier.stageId]}
                          onChange={(event) =>
                            setEarlierEdits((edits) => ({
                              ...edits,
                              [earlier.stageId]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Click to change this text"
                        className={cn(
                          'w-full rounded-md border border-l-4 border-border px-2.5 py-2 text-left text-sm hover:shadow-sm',
                          tone.soft,
                          tone.edge,
                        )}
                        data-testid="history-earlier-block"
                        onClick={() =>
                          setEarlierEdits((edits) => ({
                            ...edits,
                            [earlier.stageId]: earlier.text,
                          }))
                        }
                      >
                        {heading}
                        <span className="block whitespace-pre-wrap">{earlier.text}</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
      <div className="flex items-stretch gap-2">
        <span className="flex w-5 shrink-0 flex-col items-center pt-2.5" aria-hidden>
          <span
            className={cn(
              'h-3 w-3 shrink-0 rounded-full ring-2 ring-foreground/30 ring-offset-1',
              selected
                ? (historyTitle(selected) === 'Terminated'
                    ? TONES.red
                    : stageColors(selected.stage)
                  ).solid
                : 'bg-foreground/30',
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          {selected ? (
            <Label
              htmlFor="stage-notes-text"
              className="mb-1 mt-1 flex flex-wrap items-center gap-2"
            >
              <Badge
                variant={
                  (historyTitle(selected) === 'Terminated'
                    ? TONES.red
                    : stageColors(selected.stage)
                  ).badge
                }
              >
                ({historyTitle(selected)})
              </Badge>
              <span className="text-[11px] font-normal tabular-nums text-foreground/50">
                {when(history.path.at(-1)?.at ?? null)}
              </span>
            </Label>
          ) : null}
          <Textarea
            id="stage-notes-text"
            aria-label="History"
            rows={4}
            value={draft.notes}
            onChange={set('notes')}
            placeholder="Write what matters about this candidate at this stage…"
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          disabled={upsert.isPending || !notesDirty}
          onClick={() =>
            void captureUndo(`Edited the history of ${candidateName}`).then(() => save())
          }
        >
          {upsert.isPending ? 'Saving…' : 'Save notes'}
        </Button>
      </div>
    </section>
  );

  // Saves everything the stage holds (notes included) — pinned to the bottom of the dialog (see the Dialog's `footer`).
  const saveRow = (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-foreground/50">
        {savedFor
          ? `Last saved ${new Date(savedFor.updatedAt).toLocaleString()}`
          : 'Nothing saved for this stage yet'}
        {savedAt ? ' · saved' : ''}
      </p>
      <Button
        type="button"
        className="w-full"
        onClick={() =>
          void captureUndo(`Saved the stage record of ${candidateName}`).then(() => save())
        }
        disabled={upsert.isPending}
      >
        {upsert.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );

  const common = selected
    ? {
        application,
        stages: data!.stages.map((s) => s.stage),
        stageId: selected.stage.id,
        isCurrentStage: selected.stage.id === data!.currentStageId,
        notes: notesCard,
        // moving on keeps what was typed at this stage
        onBeforeMove: async () => {
          if (hasRecord) await save();
        },
        // a stage button is about to move the card: what it looks like now, for Undo
        onCaptureUndo: (label: string, withPlacement: boolean) =>
          captureUndo(label, { withPlacement }),
        // a target's pop-up (Screening / Interview / Reject): saves its values onto the stage being moved into
        onSaveStageNote: async (
          targetStageId: string,
          input: { notes?: string; fields?: Record<string, string | number | boolean | null> },
        ) => {
          await upsert.mutateAsync({ stageId: targetStageId, input });
        },
        getCarriedTransitionValues,
        // Permanent / Temporary: the pay is set (or, when an earlier stage's calculator already has it, shown to be
        // confirmed or changed) before the candidate is hired — it is saved with this stage by onBeforeMove
        renderPayConfirm: ({
          label,
          pending,
          error,
          onCancel,
          onConfirm,
        }: {
          label: string;
          pending: boolean;
          error: string | null;
          onCancel: () => void;
          onConfirm: () => void;
        }) => (
          <Dialog
            open
            onOpenChange={(open) => !open && !pending && onCancel()}
            title={`${label} — pay for ${application.candidate.firstName} ${application.candidate.lastName}`}
            className="max-w-2xl"
          >
            <div className="flex flex-col gap-3" data-testid="pay-confirm">
              <p className="text-sm text-foreground/60">
                {carriedPay
                  ? `This is the pay recorded at ${carriedPay.from}. Confirm it, or change it before hiring.`
                  : ownPay
                    ? 'This is the pay recorded for this candidate. Confirm it, or change it before hiring.'
                    : 'No pay has been recorded for this candidate yet — set it before hiring.'}
              </p>
              {payForm('confirm-')}
              {error ? (
                <p className="text-xs text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={pending || !(Number(draft.hourlyRate) > 0)}
                  onClick={onConfirm}
                >
                  {pending ? 'Saving…' : `Confirm pay — hire as ${label}`}
                </Button>
              </div>
            </div>
          </Dialog>
        ),
        onClose,
      }
    : null;

  // Pinned to the bottom of the dialog so Save never scrolls out of view — every stage that actually has a draft
  // to save (not Active Employees or Rejected, whose top-row buttons are the only "save" action there).
  const showSaveFooter =
    Boolean(common) &&
    reviewStage !== 'placed' &&
    reviewStage !== 'rejected' &&
    reviewStage !== 'completed';

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        // the person, then where and for what — each part set apart, with its own label
        <span
          className="flex flex-wrap items-center gap-x-6 gap-y-2"
          data-testid="stage-dialog-title"
        >
          <span className="text-lg font-semibold">
            {application.candidate.firstName} {application.candidate.lastName}
          </span>
          <span className="flex items-center gap-2 text-sm font-normal">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              Company
            </span>
            <span className="rounded-md border border-border bg-accent/40 px-2.5 py-1 font-semibold">
              {application.job.company.name}
            </span>
          </span>
          <span className="flex items-center gap-2 text-sm font-normal">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              Job
            </span>
            <span className="rounded-md border border-border bg-accent/40 px-2.5 py-1 font-semibold">
              {application.job.title}
            </span>
          </span>
        </span>
      }
      // while a CV preview window (.cv-window) is open inside it, the pop-up slides to the left and narrows so the CV has the right side
      className="max-h-[92vh] max-w-5xl overflow-y-auto transition-[margin,max-width] duration-300 [&:has(.cv-window)]:ml-4 [&:has(.cv-window)]:mr-auto [&:has(.cv-window)]:max-w-[calc(55vw-2.5rem)]"
      footer={showSaveFooter ? saveRow : undefined}
    >
      {isLoading || !data || !selected || !common ? (
        <p className="py-6 text-center text-sm text-foreground/50">Loading…</p>
      ) : reviewStage === 'new' ? (
        <StageReviewPanel
          {...common}
          targets={[
            { label: 'Screening', confirm: 'schedule' },
            { label: 'Interview', confirm: 'schedule' },
            { label: 'Rejected', type: 'REJECTED', confirm: 'notes' },
          ]}
        />
      ) : reviewStage === 'screening' ? (
        <StageReviewPanel
          {...common}
          pay={payCalculation}
          detailed
          // the point of Screening: nothing new is collected here, the file is looked at a second time
          reminder={{
            title: 'Reminder: Screening is the second review',
            text: 'Go through this candidate again — details, CV, the job they want and the notes from New — before you decide: Interview or Reject.',
          }}
          targets={[
            { label: 'Interview', confirm: 'schedule' },
            { label: 'Reject', type: 'REJECTED', confirm: 'notes' },
          ]}
        ></StageReviewPanel>
      ) : reviewStage === 'interview' ? (
        <StageReviewPanel
          {...common}
          pay={payCalculation}
          call
          documents
          // Approved moves straight to Offer; Reject needs its mandatory note first and moves to Rejected.
          // On hold is the only outcome that stays at Interview — its own pop-up (below) asks notes/date/time/
          // meeting link, all optional, same as Screening and Interview's own "schedule" targets.
          targets={[
            { label: 'Approved', name: 'Offer' },
            { label: 'Reject', type: 'REJECTED', confirm: 'notes' },
          ]}
          actions={
            <>
              <Button
                type="button"
                aria-pressed={draft.fields.decision === 'On hold'}
                className={cn(
                  TONES.amber.button,
                  draft.fields.decision === 'On hold' && 'ring-2 ring-amber-500 ring-offset-2',
                )}
                onClick={() => setConfirmingOnHold(true)}
              >
                On hold
              </Button>
              {draft.fields.decision === 'On hold' ? (
                <span className="text-sm" data-testid="stage-decision">
                  Status: <Badge variant="warning">On hold</Badge>
                </span>
              ) : null}
              {confirmingOnHold ? (
                <StageTransitionDialog
                  label="On hold"
                  mode="schedule"
                  applicationId={application.id}
                  inviteByEmail={Boolean(application.candidate.email)}
                  initialValues={getCarriedTransitionValues(stageId)}
                  pending={upsert.isPending}
                  error={onHoldError}
                  onCancel={() => setConfirmingOnHold(false)}
                  onConfirm={(values) => void confirmOnHold(values)}
                />
              ) : null}
            </>
          }
        >
          <ZoomInterviewSection application={application} withMessage={false} />
        </StageReviewPanel>
      ) : reviewStage === 'offer' ? (
        // Hiring them: Permanent or Temporary goes straight to the hired stage, and the person appears on
        // Active Employees with that type.
        <StageReviewPanel
          {...common}
          pay={payCalculation}
          call
          documents
          targets={[
            { label: 'Permanent', type: 'PLACED', employmentType: 'PERMANENT', confirm: 'pay' },
            {
              label: 'Temporary',
              type: 'PLACED',
              employmentType: 'TEMPORARY',
              className: TONES.amber.button,
              confirm: 'pay',
            },
            { label: 'Reject', type: 'REJECTED', confirm: 'notes' },
          ]}
        ></StageReviewPanel>
      ) : reviewStage === 'placed' ? (
        <StageReviewPanel
          {...common}
          pay={paySummary}
          documents
          targets={[]}
          // Either one ends the employment and removes the card from the pipeline entirely — just the two
          // buttons, no "Status: …" line (the card above already shows Permanent/Temporary).
          actions={
            <>
              <Button
                type="button"
                className={TONES.green.button}
                disabled={closingOut !== null}
                onClick={() => void closeOutEmployment('COMPLETED')}
              >
                {closingOut === 'COMPLETED' ? 'Saving…' : 'Completed'}
              </Button>
              <Button
                type="button"
                className={TONES.red.button}
                disabled={closingOut !== null}
                onClick={() => setTerminating(true)}
              >
                {closingOut === 'CANCELLED' ? 'Saving…' : 'Terminated'}
              </Button>
              {closeOutError && !terminating ? (
                <span className="text-xs text-red-600" role="alert">
                  {closeOutError}
                </span>
              ) : null}
              {terminating ? (
                <StageTransitionDialog
                  label="Terminated"
                  action="Terminate the contract"
                  notesPlaceholder="Why the contract was terminated…"
                  mode="notes"
                  applicationId={application.id}
                  inviteByEmail={false}
                  pending={closingOut === 'CANCELLED'}
                  error={closeOutError}
                  onCancel={() => setTerminating(false)}
                  onConfirm={(values) => void closeOutEmployment('CANCELLED', values.notes.trim())}
                />
              ) : null}
            </>
          }
        ></StageReviewPanel>
      ) : reviewStage === 'rejected' ? (
        <StageReviewPanel
          {...common}
          documents
          targets={[]}
          actions={
            <ReconsiderControl
              application={application}
              firstStageId={
                [...data.stages].sort((a, b) => a.stage.order - b.stage.order)[0]?.stage.id
              }
              onBefore={common.onBeforeMove}
              onCaptureUndo={captureUndo}
              onDone={onClose}
            />
          }
        />
      ) : reviewStage === 'completed' ? (
        // the contract is over: nothing moves on from here — the card is only looked at, or taken off the board
        <StageReviewPanel
          {...common}
          pay={paySummary}
          documents
          targets={[]}
          actions={
            <Button
              type="button"
              className={TONES.red.button}
              disabled={removing}
              data-testid="remove-from-pipeline"
              onClick={async () => {
                if (
                  !window.confirm(
                    'Remove this card from the pipeline? The person stays on Completed Contract and in Candidates.',
                  )
                )
                  return;
                await captureUndo(`Removed ${candidateName} from the pipeline`, {
                  kind: 'removed',
                });
                setRemoving(true);
                try {
                  await deleteApplication.mutateAsync(application.id);
                  onClose();
                } finally {
                  setRemoving(false);
                }
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />{' '}
              {removing ? 'Removing…' : 'Remove from pipeline'}
            </Button>
          }
        ></StageReviewPanel>
      ) : form ? (
        // custom stages: the same pop-up, plus the stage's own form — Reject is still available, same mandatory-notes rule as every other stage
        <StageReviewPanel
          {...common}
          pay={payCalculation}
          targets={[{ label: 'Reject', type: 'REJECTED', confirm: 'notes' }]}
        >
          <div className="rounded-lg border border-border p-3" data-testid="stage-form">
            <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-foreground/50" /> {selected.stage.name}:{' '}
              {form.title}
            </h4>
            <p className="mb-3 text-xs text-foreground/50">{form.intro}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {form.fields.map((field) => (
                <div
                  key={field.key}
                  className={cn('flex flex-col gap-1', field.wide ? 'sm:col-span-2' : '')}
                >
                  {field.type === 'rating' || field.type === 'checkbox' ? (
                    <span className="text-sm font-medium">{field.label}</span>
                  ) : (
                    <Label htmlFor={`sf-${field.key}`}>{field.label}</Label>
                  )}
                  <StageFieldInput
                    field={field}
                    value={draft.fields[field.key]}
                    onChange={(value) => setField(field.key, value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <ZoomInterviewSection application={application} />
        </StageReviewPanel>
      ) : null}
    </Dialog>
  );
}
