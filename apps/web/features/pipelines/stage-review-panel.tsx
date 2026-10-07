'use client';

import { Badge, Button, cn } from '@crm/ui';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing, Briefcase, ChevronDown, Eye, FileText, Folder, Phone, Plus, Target, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';

import { useCandidateCvs } from '@/features/candidates';
import { DocumentPreviewWindow, type PreviewableDocument } from '@/features/documents';
import { experienceLabel } from '@/features/jobs/experience';
import { CallDialog } from '@/features/phones';
import { useUpdateApplication } from '@/hooks/use-applications';
import { useCandidate } from '@/hooks/use-candidates';
import { useUploadDocument } from '@/hooks/use-documents';
import { useJob } from '@/hooks/use-jobs';
import { usePhones } from '@/hooks/use-phones';
import type { ApplicationWithRelations } from '@/services/applications.service';
import { listPlacements, updatePlacement } from '@/services/placements.service';
import type { StageNotesResponse } from '@/services/stage-notes.service';

import { LocationMap } from './location-map';
import { stageColors } from './stage-colors';
import { StageTransitionDialog, type StageTransitionValues } from './stage-transition-dialog';

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';

type Stage = StageNotesResponse['stages'][number]['stage'];

/**
 * A decision button: which stage it sends the candidate to. `name` matches the stage name, `type` the stage type.
 * A button has the colour of the stage it leads to (see stage-colors) unless `className` says otherwise.
 */
export interface StageTarget {
  label: string;
  name?: string;
  type?: Stage['type'];
  /** For the button that hires (the person lands on Active Employees with this type) — Offer's Permanent / Temporary. */
  employmentType?: EmploymentChoice;
  /**
   * Open a pop-up before moving: "schedule" asks notes + date/time/meeting link, all optional, and moves on
   * regardless of what is filled in; "notes" asks only notes and requires it — the card does not move until
   * something is written. Used by New, Screening and Interview's Screening / Interview / Reject buttons.
   * "pay" asks for the candidate's pay first (see `renderPayConfirm`) — Offer's Permanent / Temporary.
   */
  confirm?: 'schedule' | 'notes' | 'pay';
  /** Override the button's colour for one that should stand out — e.g. Offer's Permanent / Temporary. */
  className?: string;
  /** Saved onto the stage being moved into, with no pop-up — e.g. Active Employees' Terminated records why on Rejected. */
  autoNote?: { notes?: string; fields?: Record<string, string | number | boolean | null> };
  /** Runs right after the move succeeds — e.g. Terminated also closes out the Active Employees entry itself. */
  onMoved?: () => Promise<void>;
}

type EmploymentChoice = 'PERMANENT' | 'TEMPORARY';

function Detail({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="break-words text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

/** Job text fields hold one item per line (see /jobs/[id]). */
function Lines({ text }: { text: string | null | undefined }) {
  const items = (text ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <ul className="list-disc pl-4 font-normal">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

const words = (value: string | null | undefined) => (value ? value.replaceAll('_', ' ').toLowerCase() : null);
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: 'medium' }) : null);

function findStage(stages: Stage[], target: StageTarget): Stage | undefined {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  if (target.type) return sorted.find((s) => s.type === target.type);
  const name = (target.name ?? target.label).toLowerCase();
  // the exact name first, otherwise the first stage containing it ("Phone screening", "Client interview")
  return sorted.find((s) => s.name.trim().toLowerCase() === name) ?? sorted.find((s) => s.name.toLowerCase().includes(name));
}

/**
 * What the pop-up of a pipeline card shows, the same in every stage and in this order: the top row (the stage's
 * buttons and Preview CV), the Notes card, the person as they are on file in Candidates (read from their CV), their
 * CV, the job they hold and the job they are after, then `children` — what only that stage has (pay calculation,
 * Zoom interview, the stage's form).
 *
 * The top row differs per stage: `targets` send the candidate on to another stage (New, Screening); `call` rings
 * them and `decision` is the status they are left with at the stage without moving (Interview). `detailed` adds
 * the full job description, `documents` what was uploaded besides the CV.
 */
export function StageReviewPanel({
  application,
  stages,
  stageId,
  isCurrentStage,
  targets,
  detailed = false,
  brief = true,
  reminder,
  call = false,
  actions,
  documents = false,
  addDocuments = true,
  notes,
  pay,
  onBeforeMove,
  onCaptureUndo,
  onSaveStageNote,
  getCarriedTransitionValues,
  renderPayConfirm,
  onClose,
  children,
}: {
  application: ApplicationWithRelations;
  stages: Stage[];
  stageId: string;
  isCurrentStage: boolean;
  targets: StageTarget[];
  detailed?: boolean;
  /**
   * The layout every stage uses (on by default): who the person is goes in one line above the buttons (full name,
   * e-mail, phone), and the Candidate details, CV and Current job sections are left out of the body — they open
   * under that line with the "Show more" arrow, and the CV is always one click away (Preview CV, top right).
   * `brief={false}` gives the long form, with those sections in the body.
   */
  brief?: boolean;
  /** What this stage is for, stated first and prominently (Screening: the second look at the candidate). */
  reminder?: { title: string; text: string };
  /** A Call button that rings the candidate on the number on file. */
  call?: boolean;
  /** More of the stage's own buttons for the top row (Interview: On hold; Rejected: Reconsider). */
  actions?: ReactNode;
  /** Also list what was uploaded for the candidate besides the CV. */
  documents?: boolean;
  /** With `documents`: an "Add document" button, so files can be added at this stage — on wherever Documents is shown. */
  addDocuments?: boolean;
  /** The Notes card — in every stage it sits in the same place, right under the top row. */
  notes?: ReactNode;
  /** The pay calculation (or, once hired, the pay record) — always right above History, in every stage that has one. */
  pay?: ReactNode;
  /** Runs before the candidate is moved — saves what the dialog itself holds for this stage. */
  onBeforeMove?: () => Promise<void>;
  /** Runs first of all, before the move changes anything: records the card for the board's Undo button. */
  onCaptureUndo?: (label: string, withPlacement: boolean) => Promise<void>;
  /** For a target with `confirm`: saves the pop-up's values onto the stage being moved into. */
  onSaveStageNote?: (stageId: string, input: { notes?: string; fields?: Record<string, string | number | boolean | null> }) => Promise<void>;
  /** For a target with `confirm`: what to pre-fill the pop-up with — that stage's own record if it has one, otherwise the latest of any stage. */
  getCarriedTransitionValues?: (stageId: string) => StageTransitionValues & { from: string | null };
  /** For a target with `confirm: 'pay'`: the pop-up that sets the pay; its `onConfirm` then moves the candidate. */
  renderPayConfirm?: (popup: { label: string; pending: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) => ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { data: candidate } = useCandidate(application.candidate.id);
  const { data: job } = useJob(application.job.id);
  const updateApplication = useUpdateApplication();

  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  // New: the rest of what is known about the person, opened with the "Show more" arrow
  const [more, setMore] = useState(false);

  const queryClient = useQueryClient();
  // the target whose pop-up (schedule / mandatory notes) is open — nothing has moved yet
  const [confirming, setConfirming] = useState<{ target: StageTarget; stage: Stage; initial?: StageTransitionValues & { from: string | null } } | null>(
    null,
  );

  async function moveTo(
    stage: Stage,
    employmentType?: EmploymentChoice,
    noteForTarget?: { notes?: string; fields?: Record<string, string | number | boolean | null> },
    onMoved?: () => Promise<void>,
  ) {
    setError(null);
    setMoving(true);
    try {
      const from = stages.find((s) => s.id === stageId);
      await onCaptureUndo?.(
        `Moved ${application.candidate.firstName} ${application.candidate.lastName} to ${stage.name}`,
        stage.type === 'PLACED' || from?.type === 'PLACED',
      );
      await onBeforeMove?.();
      await updateApplication.mutateAsync({ id: application.id, input: { pipelineStageId: stage.id } });
      if (noteForTarget && onSaveStageNote) {
        await onSaveStageNote(stage.id, noteForTarget);
      }
      if (employmentType) {
        // reaching the hired stage created their entry on Active Employees (ApplicationsService.maybeAutoPlace,
        // with the pipeline's type): give it the type chosen here
        const placements = await listPlacements({ candidateId: application.candidate.id, jobId: application.job.id, pageSize: 5 });
        const placement = placements.items[0];
        if (!placement) throw new Error('Moved to the hired stage, but no Active Employees entry could be created — the job has no company yet.');
        if (placement.employmentType !== employmentType) await updatePlacement(placement.id, { employmentType });
        await queryClient.invalidateQueries({ queryKey: ['placements'] });
      }
      if (onMoved) await onMoved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not move to ${stage.name}.`);
      setMoving(false);
    }
  }

  /** The pop-up's Confirm: builds what to save (nothing, if every field was left empty) and moves on. */
  async function confirmTransition(values: StageTransitionValues) {
    if (!confirming) return;
    const fields: Record<string, string> = {};
    if (values.date) fields.scheduledDate = values.date;
    if (values.time) fields.scheduledTime = values.time;
    if (values.meetingLink.trim()) fields.meetingLink = values.meetingLink.trim();
    const hasAny = Boolean(values.notes.trim()) || Object.keys(fields).length > 0;
    const noteForTarget = hasAny ? { notes: values.notes.trim() || undefined, fields } : undefined;
    await moveTo(confirming.stage, confirming.target.employmentType, noteForTarget ?? confirming.target.autoNote, confirming.target.onMoved);
  }

  const salary =
    job && (job.salaryMin || job.salaryMax)
      ? `${[job.salaryMin, job.salaryMax].filter(Boolean).join(' – ')} ${job.currency}`
      : null;
  const tags = candidate?.candidateTags ?? [];
  const { cvs, others } = useCandidateCvs(application.candidate.id);
  // browser calling goes through the number as it is on the calling list (Phones); otherwise the phone app dials it
  const { data: phones } = usePhones(call ? { candidateId: application.candidate.id, pageSize: 1 } : {});
  const listedPhone = call ? phones?.items[0] : undefined;
  const number = listedPhone?.normalizedPhone ?? candidate?.phone ?? null;
  const [calling, setCalling] = useState(false);
  const [previewing, setPreviewing] = useState<PreviewableDocument | null>(null);
  const uploadDocument = useUploadDocument();
  const documentInput = useRef<HTMLInputElement>(null);

  async function addDocument(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await uploadDocument.mutateAsync({ file, type: 'OTHER', candidateId: application.candidate.id, jobId: application.job.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the document.');
    }
  }
  const currentStage = stages.find((s) => s.id === stageId);

  // The sections kept out of the way (see `brief`): they open under the person's line with "Show more".
  const candidateDetails = (
      <section className="rounded-lg border border-border p-3" data-testid="stage-candidate-details">
        {/* under "Show more" the information comes without a title */}
        {brief ? null : (
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-foreground/50" /> Candidate details
          </h4>
        )}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* these three are already in the line above the buttons: "Show more" does not repeat them */}
          {brief ? null : (
            <>
              <Detail label="Full name" value={`${application.candidate.firstName} ${application.candidate.lastName}`} />
              <Detail label="E-mail" value={candidate?.email ?? application.candidate.email} />
              <Detail label="Phone" value={candidate?.phone} />
            </>
          )}
          <Detail label="Location" value={candidate?.location} />
          <Detail label="Source" value={candidate?.source} />
          <Detail label="Status" value={words(candidate?.status)} />
          <Detail label="Potential" value={candidate ? `${candidate.potentialLabel} (${candidate.potentialScore})` : null} />
          <Detail label="Added to the CRM" value={day(candidate?.createdAt)} />
          <Detail label="Applied on" value={day(application.appliedAt)} />
          <Detail label="Application source" value={words(application.source)} />
          <Detail
            wide
            label="Tags"
            value={
              tags.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {tags.map(({ tag }) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </span>
              ) : null
            }
          />
        </dl>
        <Link href={`/candidates/${application.candidate.id}`} className="mt-3 inline-block text-xs text-primary hover:underline">
          Open candidate profile
        </Link>
      </section>
  );
  // the CV can be opened from two places in a review: the button at the top and this list
  const cvSection = (
      <section className="rounded-lg border border-border p-3" data-testid="stage-cv">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-foreground/50" /> CV
        </h4>
        {cvs.length === 0 ? (
          <p className="text-xs text-foreground/50">No CV on file.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-xs">
            {cvs.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate font-medium">{document.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-foreground/50">
                  {day(document.createdAt)}
                  <Button type="button" size="sm" onClick={() => setPreviewing(document)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
  );
  const currentJob = (
      <section className="rounded-lg border border-border p-3" data-testid="stage-current-job">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4 text-foreground/50" /> Current job
        </h4>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Job title" value={candidate?.jobTitle} />
          <Detail label="Company" value={candidate?.currentCompany ?? candidate?.company?.name} />
        </dl>
      </section>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="stage-review-panel">
      {reminder ? (
        <div className="flex items-start gap-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-amber-950" role="note" data-testid="stage-reminder">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold">{reminder.title}</p>
            <p className="text-sm">{reminder.text}</p>
          </div>
        </div>
      ) : null}
      {currentStage ? (
        <p className="flex items-center gap-2 text-sm" data-testid="stage-chip">
          <span className="text-foreground/60">Stage</span>
          <Badge variant={stageColors(currentStage).badge}>{currentStage.name}</Badge>
        </p>
      ) : null}
      {brief ? (
        // who the person is, in one line — and, at its right end, the arrow that opens the rest of what is known
        <div className="flex items-center gap-3 rounded-lg border border-border p-3" data-testid="stage-identity">
          <dl className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <Detail label="Full name" value={`${application.candidate.firstName} ${application.candidate.lastName}`} />
            <Detail label="E-mail" value={candidate?.email ?? application.candidate.email} />
            <Detail label="Phone" value={candidate?.phone} />
          </dl>
          <button
            type="button"
            aria-expanded={more}
            aria-label={more ? 'Show less' : 'Show more'}
            title={more ? 'Show less' : 'Show more'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/70 hover:bg-accent hover:text-foreground"
            data-testid="stage-show-more"
            onClick={() => setMore((shown) => !shown)}
          >
            <ChevronDown className={cn('h-5 w-5 transition-transform', more && 'rotate-180')} />
          </button>
        </div>
      ) : null}
      {brief && more ? (
        <div className="flex flex-col gap-4" data-testid="stage-more">
          {candidateDetails}
          {/* one CV is what the Preview CV button already opens; the list is only worth showing when there are several */}
          {cvs.length > 1 ? cvSection : null}
          {currentJob}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-accent/20 p-3" data-testid="stage-actions">
        <div className="flex flex-wrap items-center gap-2">
          {call ? (
            <Button
              type="button"
              disabled={!number}
              title={number ?? undefined}
              onClick={() => (listedPhone ? setCalling(true) : number && window.location.assign(`tel:${number.replace(/[^+\d]/g, '')}`))}
            >
              <Phone className="mr-1.5 h-4 w-4" /> {number ? `Call ${number}` : 'No phone number'}
            </Button>
          ) : null}
          {actions}
          {targets.map((target) => {
            const stage = findStage(stages, target);
            if (!stage || stage.id === stageId) return null;
            return (
              <Button
                key={target.label}
                type="button"
                className={target.className ?? stageColors(stage).button}
                disabled={moving || !isCurrentStage}
                onClick={() => {
                  if (target.confirm) {
                    setError(null);
                    setConfirming({ target, stage, initial: target.confirm === 'pay' ? undefined : getCarriedTransitionValues?.(stage.id) });
                  } else {
                    void moveTo(stage, target.employmentType, target.autoNote, target.onMoved);
                  }
                }}
              >
                {target.label}
              </Button>
            );
          })}
          {confirming?.target.confirm === 'pay' ? (
            renderPayConfirm?.({
              label: confirming.target.label,
              pending: moving,
              error,
              onCancel: () => setConfirming(null),
              onConfirm: () => void moveTo(confirming.stage, confirming.target.employmentType, confirming.target.autoNote, confirming.target.onMoved),
            })
          ) : confirming ? (
            <StageTransitionDialog
              label={confirming.target.label}
              mode={confirming.target.confirm as 'schedule' | 'notes'}
              applicationId={application.id}
              inviteByEmail={Boolean(application.candidate.email)}
              initialValues={confirming.initial}
              pending={moving}
              error={error}
              onCancel={() => setConfirming(null)}
              onConfirm={(values) => void confirmTransition(values)}
            />
          ) : null}
        </div>
        <Button type="button" disabled={!cvs[0]} onClick={() => cvs[0] && setPreviewing(cvs[0])}>
          <Eye className="mr-1.5 h-4 w-4" /> {cvs[0] ? 'Preview CV' : 'No CV on file'}
        </Button>
      </div>
      {isCurrentStage ? null : (
        <p className="text-xs text-foreground/50">
          This candidate is not at {currentStage?.name ?? 'this stage'} (now: {application.pipelineStage.name}).
        </p>
      )}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {pay}

      {notes}

      {brief ? null : candidateDetails}

      {brief ? null : cvSection}

      {documents ? (
        <section className="rounded-lg border border-border p-3" data-testid="stage-documents">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Folder className="h-4 w-4 text-foreground/50" /> Documents
            </h4>
            {addDocuments ? (
              <>
                <input
                  ref={documentInput}
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  className="hidden"
                  data-testid="add-document-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    void addDocument(file);
                  }}
                />
                <Button type="button" size="sm" disabled={uploadDocument.isPending} onClick={() => documentInput.current?.click()}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> {uploadDocument.isPending ? 'Uploading…' : 'Add document'}
                </Button>
              </>
            ) : null}
          </div>
          {others.length === 0 ? (
            <p className="text-xs text-foreground/50">No other documents uploaded for this candidate.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-xs">
              {others.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="truncate font-medium">{document.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-foreground/50">
                    {words(document.type)} · {day(document.createdAt)}
                    <Button type="button" size="sm" onClick={() => setPreviewing(document)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {brief ? null : currentJob}

      <section className="rounded-lg border border-border p-3">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-foreground/50" /> Job they are applying for
        </h4>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Job" value={application.job.title} />
          <Detail label="Company" value={application.job.company.name} />
          <Detail label="Location" value={job?.location} />
          <Detail label="Experience required" value={experienceLabel(job?.experienceYearsMin, job?.experienceYearsMax)} />
          <Detail label="Salary" value={salary} />
          <Detail label="Pay package" value={job?.compensationPackage} />
          {detailed ? (
            <>
              <Detail label="Employment type" value={words(job?.employmentType)} />
              <Detail label="Job status" value={words(job?.status)} />
              <Detail wide label="What the job is" value={job?.description} />
              <Detail wide label="What the candidate will do" value={<Lines text={job?.responsibilities} />} />
              <Detail wide label="What is required" value={<Lines text={job?.requirements} />} />
            </>
          ) : null}
        </dl>
        {/* where the work is and where the candidate is — both typed over at will — with the route and the distance between them */}
        <LocationMap
          className="mt-4"
          storageKey={application.id}
          from={{ label: 'Job', query: job?.location || [job?.company?.city, job?.company?.country].filter(Boolean).join(', ') }}
          to={{ label: 'Candidate', query: candidate?.location }}
        />
        <Link href={`/jobs/${application.job.id}`} className="mt-3 inline-block text-xs text-primary hover:underline">
          Open job
        </Link>
      </section>

      {children}

      {calling && listedPhone ? <CallDialog phone={listedPhone} onClose={() => setCalling(false)} /> : null}
      {/* a floating window, not a modal: the stage pop-up stays open and usable while the CV is moved and resized beside it */}
      {previewing ? <DocumentPreviewWindow document={previewing} onClose={() => setPreviewing(null)} onEdited={(edited) => setPreviewing(edited)} /> : null}
    </div>
  );
}
