'use client';

import type { PipelineStage } from '@crm/types';
import { Badge, Button, cn, Dialog, Input, Label, Select, SearchSelect } from '@crm/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  EyeOff,
  GitBranch,
  GripVertical,
  NotebookPen,
  Pencil,
  Trash2,
  Redo2,
  Undo2,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import {
  DateRangeFilter,
  dateRangeBounds,
  type DateRange,
  EmploymentTypeBadge,
  MeetingBadge,
  PayBadge,
  StageNotesDialog,
  StageStatusBadge,
  StageTransitionDialog,
  type StageTransitionValues,
  isCompletedStage,
  jobMarks,
  noteSnapshot,
  placementSnapshot,
  pushUndo,
  stageColors,
  useEmploymentTypes,
  useNextMeetings,
  stepHistory,
  takeStep,
  useRedoStack,
  useUndoStack,
  type Direction,
} from '@/features/pipelines';
import { AddedByFilter } from '@/features/users';
import {
  useApplications,
  useDeleteApplication,
  useToggleChecklistItem,
  useUpdateApplication,
} from '@/hooks/use-applications';
import { useCandidates } from '@/hooks/use-candidates';
import { useCompanies } from '@/hooks/use-companies';
import { useJobs } from '@/hooks/use-jobs';
import {
  useCreateChecklistItem,
  useCreatePipelineStage,
  useDeleteChecklistItem,
  useDeletePipelineStage,
  usePipelines,
  useUpdatePipelineStage,
} from '@/hooks/use-pipelines';
import { ApiClientError } from '@/lib/api-client';
import type { ApplicationWithRelations } from '@/services/applications.service';
import { upsertStageNote, type UpsertStageNoteInput } from '@/services/stage-notes.service';

const STAGE_TYPE_OPTIONS = ['STANDARD', 'PLACED', 'REJECTED'] as const;
const EMPLOYMENT_LABEL = { PERMANENT: 'Permanent', TEMPORARY: 'Temporary' } as const;
/** Whether the board's Completed column is hidden — a per-device preference. */
const HIDE_COMPLETED_KEY = 'crm.pipeline.hideCompleted';

function byName<T>(nameOf: (item: T) => string) {
  return (a: T, b: T) => nameOf(a).localeCompare(nameOf(b));
}

/**
 * The board applicants actually move through: every application on the
 * active pipeline shows up as a card in its current stage's column,
 * optionally narrowed by candidate/company/job — drag a card to another
 * column, or use its "Move to" select, to change its pipelineStageId.
 * Moving a card to the "Placed" stage triggers the same auto-Placement
 * logic as everywhere else (ApplicationsService). Which pipeline is
 * "active" isn't user-switchable from this filter bar — it's whichever
 * pipeline is selected via pipelineId (URL-seeded) or the first one found;
 * Edit/Delete in the header act on that one.
 */
// `useSearchParams()` must sit under a Suspense boundary so the route can be
// statically prerendered (Next 14 fails `next build` otherwise). Rendering is
// unchanged: the page body still renders client-side after hydration.
export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <PipelinePageContent />
    </Suspense>
  );
}

function PipelinePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  // Seeded from the URL so a link like /pipeline?jobId=... (from Applications
  // or Contacts) lands already filtered, not just on the unfiltered board.
  const [pipelineId, setPipelineId] = useState<string | null>(searchParams.get('pipelineId'));
  const [companyId, setCompanyId] = useState(searchParams.get('companyId') ?? '');
  const [jobId, setJobId] = useState(searchParams.get('jobId') ?? '');
  const [candidateId, setCandidateId] = useState(searchParams.get('candidateId') ?? '');

  useEffect(() => {
    if (!pipelineId && pipelines && pipelines.length > 0) {
      setPipelineId(pipelines[0]!.id);
    }
  }, [pipelines, pipelineId]);

  // Keeps the URL in sync with the filter bar — makes the board linkable
  // (e.g. Applications' "View in pipeline" jumps straight to the right
  // job/company) and shareable/bookmarkable as-is.
  useEffect(() => {
    const params = new URLSearchParams();
    if (pipelineId) params.set('pipelineId', pipelineId);
    if (companyId) params.set('companyId', companyId);
    if (jobId) params.set('jobId', jobId);
    if (candidateId) params.set('candidateId', candidateId);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, companyId, jobId, candidateId]);

  const pipeline = pipelines?.find((p) => p.id === pipelineId) ?? null;

  const { data: companies } = useCompanies({ pageSize: 100 });
  const { data: jobs } = useJobs({ pageSize: 100, companyId: companyId || undefined });
  // Only candidates actually on a board — i.e. someone clicked "Add to
  // pipeline" for them on /candidates — not the whole candidate pool
  // (unassigned leads aren't on any board to filter to).
  const { data: candidates } = useCandidates({ pageSize: 100, hasApplications: true });

  const sortedCompanies = useMemo(
    () => [...(companies?.items ?? [])].sort(byName((c) => c.name)),
    [companies],
  );
  const sortedJobs = useMemo(() => [...(jobs?.items ?? [])].sort(byName((j) => j.title)), [jobs]);
  const sortedCandidates = useMemo(
    () => [...(candidates?.items ?? [])].sort(byName((c) => `${c.firstName} ${c.lastName}`)),
    [candidates],
  );

  // Pay filter: only applicants whose recorded pay (stage notes, e.g. at Offer) falls in this hourly range.
  const [payMin, setPayMin] = useState('');
  const [payMax, setPayMax] = useState('');
  const [ownerId, setOwnerId] = useState('');
  // Date filter (the calendar next to Undo): only cards added to the pipeline in these days; null = every date.
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const appliedBounds = dateRangeBounds(dateRange);

  const { data: applications } = useApplications({
    appliedFrom: appliedBounds.from,
    appliedTo: appliedBounds.to,
    ownerId: ownerId || undefined,
    pipelineId: pipelineId ?? undefined,
    companyId: companyId || undefined,
    jobId: jobId || undefined,
    candidateId: candidateId || undefined,
    minHourlyRate: payMin === '' ? undefined : Number(payMin),
    maxHourlyRate: payMax === '' ? undefined : Number(payMax),
    pageSize: 100,
  });
  // a candidate with several cards (one per job applied for): each of their jobs gets its own colour
  const marks = useMemo(() => jobMarks(applications?.items ?? []), [applications]);
  const selectedCandidateCards = useMemo(
    () =>
      (applications?.items ?? [])
        .filter((a) => a.candidate.id === candidateId && marks.has(a.id))
        .sort((a, b) => marks.get(a.id)!.position - marks.get(b.id)!.position),
    [applications, candidateId, marks],
  );
  const updateApplication = useUpdateApplication();
  const deleteApplication = useDeleteApplication();
  // The Completed column (finished contracts) can be put out of sight; remembered on this device.
  const [hideCompleted, setHideCompleted] = useState(false);
  useEffect(() => {
    try {
      setHideCompleted(localStorage.getItem(HIDE_COMPLETED_KEY) === '1');
    } catch {
      /* storage blocked: the column simply shows */
    }
  }, []);
  const toggleCompleted = () =>
    setHideCompleted((hidden) => {
      try {
        localStorage.setItem(HIDE_COMPLETED_KEY, hidden ? '0' : '1');
      } catch {
        /* storage blocked: not remembered */
      }
      return !hidden;
    });
  const toggleChecklistItem = useToggleChecklistItem();

  const createStage = useCreatePipelineStage();
  const updateStage = useUpdatePipelineStage();
  const deleteStage = useDeletePipelineStage();

  // Holds the stage's id, not the stage object itself — the object is
  // re-derived from the live `pipeline` on every render (below) so the
  // dialog's checklist section stays in sync as items are added/removed,
  // instead of freezing on a stale snapshot taken at open-time.
  const [stageDialog, setStageDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; stageId: string } | null
  >(null);

  // Native HTML5 drag-and-drop — no extra dependency for one interaction.
  // The "Move to" select on each card stays as a keyboard/touch-friendly
  // fallback; dragging is the fast path, not the only path.
  const [draggedApplicationId, setDraggedApplicationId] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<ApplicationWithRelations | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // A link from a candidate's page (?open=<application>) lands on their card with its pop-up already open.
  const [openOnArrival, setOpenOnArrival] = useState(searchParams.get('open'));
  useEffect(() => {
    if (!openOnArrival || !applications) return;
    const target = applications.items.find((a) => a.id === openOnArrival);
    if (target) setNotesFor(target);
    setOpenOnArrival(null);
  }, [openOnArrival, applications]);

  const queryClient = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);

  /** What Undo needs to know about a card before an action changes it: its stage and every stage's record. */
  const cardSnapshot = (card: ApplicationWithRelations) => ({
    applicationId: card.id,
    stageId: card.pipelineStage.id,
    notes: Object.fromEntries(
      (pipeline?.stages ?? []).map((s) => [
        s.id,
        noteSnapshot(card.stageNotes?.find((n) => n.pipelineStageId === s.id)),
      ]),
    ),
  });
  // Undo / Redo: the latest action on a card is taken back, or done again (see features/pipelines/undo.ts)
  const lastAction = useUndoStack().at(-1);
  const nextAction = useRedoStack().at(-1);
  /**
   * One press, one step — back (Undo) or forward again (Redo) — and at once: the record leaves its list and the
   * board shows the card where the record says, before the server has been asked. The server is put right in the
   * background (steps are queued, so several quick presses stay in order). If that fails the record goes back to
   * its list and the board is re-read.
   */
  function step(direction: Direction) {
    const entry = takeStep(direction);
    if (!entry) return;
    setMoveError(null);
    void queryClient.cancelQueries({ queryKey: ['applications', 'list'] });
    const stage = pipeline?.stages.find((st) => st.id === entry.stageId);
    const cardNow = applications?.items.find((a) => a.id === entry.applicationId);
    const removedCard =
      entry.kind === 'removed' ? (entry.card as ApplicationWithRelations | undefined) : undefined;
    queryClient.setQueriesData<{ items?: ApplicationWithRelations[] }>(
      { queryKey: ['applications', 'list'] },
      (list) => {
        if (!list?.items) return list;
        if (entry.kind === 'created')
          return { ...list, items: list.items.filter((a) => a.id !== entry.applicationId) };
        if (removedCard) {
          // back on the boards of its own pipeline (the lists that already hold cards of that pipeline)
          const belongs =
            !list.items.some((a) => a.id === removedCard.id) &&
            list.items.some((a) => a.pipelineId === removedCard.pipelineId);
          return belongs ? { ...list, items: [removedCard, ...list.items] } : list;
        }
        if (!stage) return list;
        return {
          ...list,
          items: list.items.map((a) =>
            a.id === entry.applicationId
              ? {
                  ...a,
                  pipelineStageId: stage.id,
                  pipelineStage: {
                    ...a.pipelineStage,
                    id: stage.id,
                    name: stage.name,
                    type: stage.type,
                    order: stage.order,
                  },
                }
              : a,
          ),
        };
      },
    );
    // what the board showed before this step — enough for the other button to move the card straight back
    const shown =
      entry.kind === 'removed'
        ? ({ kind: 'created', stageId: entry.stageId } as const)
        : entry.kind === 'created'
          ? ({
              kind: 'removed',
              stageId: cardNow?.pipelineStage.id ?? entry.stageId,
              card: cardNow,
            } as const)
          : ({ kind: 'changed', stageId: cardNow?.pipelineStage.id ?? entry.stageId } as const);
    stepHistory(direction, entry, shown)
      .catch((error: unknown) => {
        setMoveError(
          `${direction === 'undo' ? 'Undo' : 'Redo'} failed: ${error instanceof Error ? error.message : 'please try again'}`,
        );
      })
      .finally(() => {
        for (const queryKey of [['applications'], ['placements'], ['candidates']])
          void queryClient.invalidateQueries({ queryKey });
      });
  }
  // a card dropped on another column (or sent there with "Move to"): the pop-up that opens before it moves
  const [dropMove, setDropMove] = useState<{
    application: ApplicationWithRelations;
    stage: PipelineStage;
  } | null>(null);

  /**
   * Moves a card. The board shows it in its new column at once — the list in the cache is rewritten before the
   * request leaves — and the server is told in the background (the move and, if the pop-up collected one, the
   * target stage's note go out together). If saving fails the board is re-read, which puts the card back.
   */
  function moveApplication(applicationId: string, stageId: string, note?: UpsertStageNoteInput) {
    const stage = pipeline?.stages.find((s) => s.id === stageId);
    const card = applications?.items.find((a) => a.id === applicationId);
    if (!stage || !card || card.pipelineStage.id === stageId) return;
    setMoveError(null);
    void queryClient.cancelQueries({ queryKey: ['applications', 'list'] });
    queryClient.setQueriesData<{ items?: ApplicationWithRelations[] }>(
      { queryKey: ['applications', 'list'] },
      (list) =>
        list?.items
          ? {
              ...list,
              items: list.items.map((a) =>
                a.id === applicationId
                  ? {
                      ...a,
                      pipelineStageId: stage.id,
                      pipelineStage: {
                        ...a.pipelineStage,
                        id: stage.id,
                        name: stage.name,
                        type: stage.type,
                        order: stage.order,
                      },
                    }
                  : a,
              ),
            }
          : list,
    );
    // for Undo: the card as it was — and, when the move hires or un-hires, the Active Employees entry as it is
    // now, read before the move is sent (the board has already moved the card, so nobody waits for it)
    const touchesHire = stage.type === 'PLACED' || card.pipelineStage.type === 'PLACED';
    (touchesHire ? placementSnapshot(card.candidate.id, card.job.id) : Promise.resolve(undefined))
      .then((placement) => {
        pushUndo({
          ...cardSnapshot(card),
          label: `Moved ${card.candidate.firstName} ${card.candidate.lastName} to ${stage.name}`,
          kind: 'changed',
          placement,
        });
        return Promise.all([
          updateApplication.mutateAsync({ id: applicationId, input: { pipelineStageId: stageId } }),
          note ? upsertStageNote(applicationId, stageId, note) : null,
        ]);
      })
      .catch((error: unknown) => {
        setMoveError(
          `${card.candidate.firstName} ${card.candidate.lastName} could not be moved to ${stage.name}: ${error instanceof Error ? error.message : 'please try again'}`,
        );
      })
      .finally(() => void queryClient.invalidateQueries({ queryKey: ['applications'] }));
  }

  /**
   * A drop (or "Move to"): the same pop-up the stage buttons open — "Move to Screening" with notes, date and time,
   * all optional; notes mandatory when the target is Rejected. Hiring and Completed have nothing to ask and move
   * straight away.
   */
  function requestMove(applicationId: string, stageId: string) {
    const stage = pipeline?.stages.find((s) => s.id === stageId);
    const card = applications?.items.find((a) => a.id === applicationId);
    if (!stage || !card || card.pipelineStage.id === stageId) return;
    if (stage.type === 'PLACED' || isCompletedStage(stage)) moveApplication(applicationId, stageId);
    else setDropMove({ application: card, stage });
  }

  /** The pop-up's Confirm: closes at once, the card moves, and what was filled in is saved on the target stage. */
  function confirmDropMove(values: StageTransitionValues) {
    if (!dropMove) return;
    const fields: Record<string, string> = {};
    if (values.date) fields.scheduledDate = values.date;
    if (values.time) fields.scheduledTime = values.time;
    if (values.meetingLink.trim()) fields.meetingLink = values.meetingLink.trim();
    const hasAny = Boolean(values.notes.trim()) || Object.keys(fields).length > 0;
    moveApplication(
      dropMove.application.id,
      dropMove.stage.id,
      hasAny ? { notes: values.notes.trim() || undefined, fields } : undefined,
    );
    setDropMove(null);
  }
  // what the target stage already holds for this card (it has been there before): the pop-up starts from it
  const dropMoveRecord = dropMove?.application.stageNotes?.find(
    (n) => n.pipelineStageId === dropMove.stage.id,
  );
  const recorded = (key: string) =>
    typeof dropMoveRecord?.fields?.[key] === 'string' ? (dropMoveRecord.fields[key] as string) : '';

  const nextMeetings = useNextMeetings();
  const employmentTypes = useEmploymentTypes();
  const applicationsByStage = new Map<string, ApplicationWithRelations[]>();
  for (const application of applications?.items ?? []) {
    const list = applicationsByStage.get(application.pipelineStage.id) ?? [];
    list.push(application);
    applicationsByStage.set(application.pipelineStage.id, list);
  }

  async function handleDeleteStage(stage: PipelineStage) {
    if (!window.confirm(`Delete the "${stage.name}" stage?`)) return;
    try {
      await deleteStage.mutateAsync(stage.id);
    } catch (error) {
      window.alert(
        error instanceof ApiClientError ? error.message : 'Could not delete this stage.',
      );
    }
  }

  if (pipelinesLoading) {
    return <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* one pipeline, the agency's own stages: there is no scheme to pick and none to add (the board shows the first pipeline) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pipeline Candidates</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Every applicant, grouped by stage — filter by candidate, company, or job, and drag a
            card to another column to move it.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {/* the calendar, left of Undo: picking a range narrows the board below to the cards added in those days */}
          <DateRangeFilter className="mr-2" value={dateRange} onChange={setDateRange} />
          {/* Undo / Redo, next to the title: one step back in what was done to the cards (a move, a hire, Completed, a removal…), or one step forward again */}
          <div
            className="mr-2 flex items-center gap-2 border-r border-border pr-3"
            data-testid="undo-bar"
          >
            <Button
              type="button"
              variant="outline"
              className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:border-border disabled:bg-background disabled:text-foreground/40"
              disabled={!lastAction}
              onClick={() => step('undo')}
              title={lastAction ? `Undo: ${lastAction.label}` : 'Nothing to undo yet'}
              data-testid="undo-button"
            >
              <Undo2 className="mr-1.5 h-4 w-4" />
              Undo
            </Button>
            {/* one step forward again: what Undo took back */}
            <Button
              type="button"
              variant="outline"
              className="border-sky-400 bg-sky-50 text-sky-900 hover:bg-sky-100 disabled:border-border disabled:bg-background disabled:text-foreground/40"
              disabled={!nextAction}
              onClick={() => step('redo')}
              title={nextAction ? `Redo: ${nextAction.label}` : 'Nothing to redo'}
              data-testid="redo-button"
            >
              Redo
              <Redo2 className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {!pipelines || pipelines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <GitBranch className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No pipeline yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Create a pipeline to define the stages applicants move through — from first contact to
            placed.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="candidate-filter">Candidates</Label>
              <SearchSelect
                id="candidate-filter"
                className="w-44 sm:w-56"
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
              >
                <option value="">All candidates</option>
                {sortedCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </SearchSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-filter">Company</Label>
              <SearchSelect
                id="company-filter"
                className="w-44 sm:w-56"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setJobId('');
                }}
              >
                <option value="">All companies</option>
                {sortedCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SearchSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-filter">Job</Label>
              <SearchSelect
                id="job-filter"
                className="w-44 sm:w-56"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">All jobs</option>
                {sortedJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </SearchSelect>
            </div>

            <AddedByFilter value={ownerId} onChange={setOwnerId} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-min">Pay / hour</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="pay-min"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="from"
                  className="w-20"
                  value={payMin}
                  onChange={(e) => setPayMin(e.target.value)}
                />
                <span className="text-xs text-foreground/50">–</span>
                <Input
                  id="pay-max"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="to"
                  className="w-20"
                  value={payMax}
                  onChange={(e) => setPayMax(e.target.value)}
                />
              </div>
            </div>

            {(candidateId || companyId || jobId || payMin || payMax) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCandidateId('');
                  setCompanyId('');
                  setJobId('');
                  setPayMin('');
                  setPayMax('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* one candidate picked, and they are here for several jobs: said outright, each job in its card's colour */}
          {pipeline && candidateId && selectedCandidateCards.length > 1 ? (
            <div
              className="rounded-lg border-2 border-foreground/20 bg-background p-3 shadow-sm"
              data-testid="candidate-jobs-summary"
            >
              <p className="text-sm font-semibold">
                {selectedCandidateCards[0]!.candidate.firstName}{' '}
                {selectedCandidateCards[0]!.candidate.lastName} is in this pipeline for{' '}
                {selectedCandidateCards.length} different jobs
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCandidateCards.map((application) => {
                  const mark = marks.get(application.id)!;
                  return (
                    <button
                      key={application.id}
                      type="button"
                      title="Open this application"
                      className={cn(
                        'flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-sm hover:shadow-md',
                      )}
                      onClick={() => setNotesFor(application)}
                    >
                      <span
                        className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', mark.chip)}
                      >
                        Job {mark.position}
                      </span>
                      <span>
                        <span className="font-semibold">{application.job.title}</span>
                        <span className="text-foreground/60">
                          {' '}
                          · {application.job.company.name}
                        </span>
                      </span>
                      <Badge variant={stageColors(application.pipelineStage).badge}>
                        {application.pipelineStage.name}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {moveError ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {moveError}
            </p>
          ) : null}

          {pipeline ? (
            <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
              <div className="flex gap-4">
                {pipeline.stages.map((stage) => {
                  const cards = applicationsByStage.get(stage.id) ?? [];
                  const isDragTarget = dragOverStageId === stage.id;
                  // the stage's own colour: the column, the edge of its cards, its badge
                  const tone = stageColors(stage);
                  // Completed, hidden: only a narrow strip is left of the column, with the way back in it
                  if (hideCompleted && isCompletedStage(stage)) {
                    return (
                      <div
                        key={stage.id}
                        data-stage-name={stage.name}
                        data-collapsed="true"
                        className={cn(
                          'flex w-11 shrink-0 flex-col items-center gap-2 self-start overflow-hidden rounded-lg border bg-accent/20 pb-3',
                          tone.border,
                        )}
                      >
                        <div className={cn('h-1.5 w-full', tone.solid)} />
                        <button
                          type="button"
                          title="Show Completed"
                          aria-label="Show Completed"
                          data-testid="toggle-completed"
                          onClick={toggleCompleted}
                          className="rounded p-1 text-foreground/60 hover:bg-accent hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                            tone.chip,
                          )}
                        >
                          {cards.length}
                        </span>
                        <span className="text-xs font-semibold text-foreground/70 [writing-mode:vertical-rl]">
                          {stage.name}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={stage.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverStageId !== stage.id) setDragOverStageId(stage.id);
                      }}
                      onDragLeave={() =>
                        setDragOverStageId((current) => (current === stage.id ? null : current))
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverStageId(null);
                        if (draggedApplicationId) requestMove(draggedApplicationId, stage.id);
                        setDraggedApplicationId(null);
                      }}
                      data-stage-name={stage.name}
                      className={cn(
                        'flex w-[80vw] shrink-0 flex-col overflow-hidden rounded-lg border bg-accent/20 transition-colors sm:w-72',
                        isDragTarget
                          ? 'border-primary bg-accent/50 ring-2 ring-primary/30'
                          : tone.border,
                      )}
                    >
                      <div className={cn('h-1.5', tone.solid)} />
                      <div
                        className={cn(
                          'flex items-center justify-between gap-2 border-b px-3 py-2.5',
                          tone.soft,
                          tone.border,
                        )}
                      >
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            {stage.name}
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                                tone.chip,
                              )}
                            >
                              {cards.length}
                            </span>
                            {isCompletedStage(stage) ? (
                              <button
                                type="button"
                                title="Hide this column"
                                data-testid="toggle-completed"
                                onClick={toggleCompleted}
                                className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground/70 hover:bg-accent"
                              >
                                <EyeOff className="h-3 w-3" /> Hide
                              </button>
                            ) : null}
                          </p>
                          <p className="text-xs text-foreground/60">
                            {cards.length === 1 ? 'applicant' : 'applicants'}
                            {stage.type === 'PLACED'
                              ? ` · hired as ${(EMPLOYMENT_LABEL[pipeline.employmentType] ?? 'Permanent').toLowerCase()}`
                              : stage.type !== 'STANDARD'
                                ? ` · ${stage.type}`
                                : ''}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setStageDialog({ mode: 'edit', stageId: stage.id })}
                            aria-label="Edit stage"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStage(stage)}
                            aria-label="Delete stage"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
                        {cards.length === 0 ? (
                          <p
                            className={cn(
                              'rounded-md border border-dashed px-2 py-6 text-center text-xs',
                              isDragTarget
                                ? 'border-primary text-primary'
                                : 'border-transparent text-foreground/40',
                            )}
                          >
                            {isDragTarget ? 'Drop here' : 'No applicants here'}
                          </p>
                        ) : (
                          cards.map((application) => (
                            <div
                              key={application.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedApplicationId(application.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={() => {
                                setDraggedApplicationId(null);
                                setDragOverStageId(null);
                              }}
                              onClick={(e) => {
                                if (
                                  (e.target as HTMLElement).closest(
                                    'a,button,input,select,textarea,label',
                                  )
                                )
                                  return;
                                setNotesFor(application);
                              }}
                              title="Open stage notes & pay calculation"
                              className={cn(
                                'flex cursor-grab flex-col gap-1.5 rounded-md border border-l-4 border-border bg-background p-2.5 text-sm shadow-sm hover:shadow-md active:cursor-grabbing',
                                // the card is tinted in its stage's colour; a job colour (several applications) goes on top
                                tone.soft,
                                tone.border,
                                tone.edge,
                                draggedApplicationId === application.id ? 'opacity-40' : '',
                              )}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="inline-flex items-start gap-1">
                                  <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/30" />
                                  {/* plain text, not links: a click anywhere on the card opens the pop-up and never leaves the board */}
                                  <span className="font-medium" data-testid="card-name">
                                    {application.candidate.firstName}{' '}
                                    {application.candidate.lastName}
                                  </span>
                                </span>
                                {/* Active Employees shows Permanent/Temporary (inherited from Offer) here instead of
                                    Active/Terminated/Contracted — that decision is still made inside the card */}
                                {stage.type === 'PLACED' ? (
                                  <EmploymentTypeBadge
                                    application={application}
                                    employmentTypes={employmentTypes}
                                  />
                                ) : (
                                  <StageStatusBadge application={application} stage={stage} />
                                )}
                              </div>
                              {marks.has(application.id) ? (
                                <p
                                  className="flex flex-wrap items-center gap-1.5 pl-4.5 text-xs text-foreground/70"
                                  data-testid="card-job-mark"
                                >
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded px-1.5 py-0.5 font-semibold',
                                      marks.get(application.id)!.chip,
                                    )}
                                    title={`This candidate has ${marks.get(application.id)!.total} applications on this board`}
                                  >
                                    {application.job.title}
                                  </span>
                                  <span>{application.job.company.name}</span>
                                  <span className="font-semibold text-foreground">
                                    Job {marks.get(application.id)!.position} of{' '}
                                    {marks.get(application.id)!.total}
                                  </span>
                                </p>
                              ) : (
                                <p className="pl-4.5 text-xs text-foreground/50">
                                  {application.job.title}
                                  {' · '}
                                  {application.job.company.name}
                                </p>
                              )}
                              <PayBadge application={application} />
                              <MeetingBadge event={nextMeetings.get(application.candidate.id)} />
                              {stage.checklistItems.length > 0 ? (
                                <div className="flex flex-col gap-1 border-t border-border pt-1.5">
                                  {stage.checklistItems.map((item) => {
                                    const checked =
                                      application.checklistResponses.find(
                                        (r) => r.checklistItemId === item.id,
                                      )?.completed ?? false;
                                    return (
                                      <label
                                        key={item.id}
                                        className="flex cursor-pointer items-start gap-1.5 text-xs text-foreground/70"
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
                                          checked={checked}
                                          onChange={(e) =>
                                            toggleChecklistItem.mutate({
                                              applicationId: application.id,
                                              checklistItemId: item.id,
                                              completed: e.target.checked,
                                            })
                                          }
                                        />
                                        <span
                                          className={
                                            checked ? 'text-foreground/40 line-through' : ''
                                          }
                                        >
                                          {item.label}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : null}
                              {isCompletedStage(stage) ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 justify-start text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                                  disabled={deleteApplication.isPending}
                                  data-testid="card-remove"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Remove ${application.candidate.firstName} ${application.candidate.lastName} from the pipeline? They stay on Completed Contract and in Candidates.`,
                                      )
                                    ) {
                                      pushUndo({
                                        ...cardSnapshot(application),
                                        label: `Removed ${application.candidate.firstName} ${application.candidate.lastName} from the pipeline`,
                                        kind: 'removed',
                                        card: application,
                                      });
                                      deleteApplication.mutate(application.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove from pipeline
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 justify-start text-xs"
                                onClick={() => setNotesFor(application)}
                              >
                                <NotebookPen className="mr-1 h-3.5 w-3.5" /> Stage notes &amp; pay
                              </Button>
                              <Select
                                className="h-8 text-xs"
                                value={stage.id}
                                onChange={(e) => requestMove(application.id, e.target.value)}
                              >
                                {pipeline.stages.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Move to: {s.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      {stageDialog && pipeline ? (
        <StageDialog
          mode={stageDialog.mode}
          stage={
            stageDialog.mode === 'edit'
              ? pipeline.stages.find((s) => s.id === stageDialog.stageId)
              : undefined
          }
          onClose={() => setStageDialog(null)}
          onSave={async (values) => {
            if (stageDialog.mode === 'edit') {
              await updateStage.mutateAsync({ id: stageDialog.stageId, input: values });
            } else {
              await createStage.mutateAsync({ pipelineId: pipeline.id, ...values });
            }
            setStageDialog(null);
          }}
        />
      ) : null}
      {notesFor ? (
        <StageNotesDialog application={notesFor} onClose={() => setNotesFor(null)} />
      ) : null}

      {dropMove ? (
        <StageTransitionDialog
          key={`${dropMove.application.id}-${dropMove.stage.id}`}
          label={dropMove.stage.name}
          mode={dropMove.stage.type === 'REJECTED' ? 'notes' : 'schedule'}
          applicationId={dropMove.application.id}
          inviteByEmail={Boolean(dropMove.application.candidate.email)}
          initialValues={{
            notes: dropMove.stage.type === 'REJECTED' ? '' : (dropMoveRecord?.notes ?? ''),
            date: recorded('scheduledDate'),
            time: recorded('scheduledTime'),
            meetingLink: recorded('meetingLink'),
            from: null,
          }}
          pending={false}
          onCancel={() => setDropMove(null)}
          onConfirm={confirmDropMove}
        />
      ) : null}
    </div>
  );
}

function StageDialog({
  mode,
  stage,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  stage?: PipelineStage;
  onClose: () => void;
  onSave: (values: { name: string; type: (typeof STAGE_TYPE_OPTIONS)[number] }) => Promise<void>;
}) {
  const [name, setName] = useState(stage?.name ?? '');
  const [type, setType] = useState<(typeof STAGE_TYPE_OPTIONS)[number]>(stage?.type ?? 'STANDARD');
  const [saving, setSaving] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');

  const createChecklistItem = useCreateChecklistItem();
  const deleteChecklistItem = useDeleteChecklistItem();

  return (
    <Dialog open onOpenChange={onClose} title={mode === 'edit' ? 'Edit stage' : 'Add stage'}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stage-name">Stage name</Label>
          <Input id="stage-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stage-type">Type</Label>
          <Select
            id="stage-type"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof STAGE_TYPE_OPTIONS)[number])}
          >
            {STAGE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <p className="text-xs text-foreground/50">
            &quot;Placed&quot; automatically creates a Placement when an application reaches it.
          </p>
        </div>

        {mode === 'edit' && stage ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label>Checklist for this stage</Label>
            <p className="-mt-1 text-xs text-foreground/50">
              The tests/questions an applicant must clear here — shown as checkboxes on their card.
            </p>
            <div className="flex flex-col gap-1.5">
              {stage.checklistItems.length === 0 ? (
                <p className="text-xs text-foreground/40">No checklist items yet.</p>
              ) : (
                stage.checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
                  >
                    <span>{item.label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChecklistItem.mutate(item.id)}
                      aria-label="Remove checklist item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Technical screen passed"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!newItemLabel.trim() || createChecklistItem.isPending}
                onClick={async () => {
                  await createChecklistItem.mutateAsync({
                    stageId: stage.id,
                    input: { label: newItemLabel.trim() },
                  });
                  setNewItemLabel('');
                }}
              >
                Add
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              await onSave({ name: name.trim(), type });
              setSaving(false);
            }}
          >
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add stage'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
