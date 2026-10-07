'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, cn } from '@crm/ui';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, Building2, ChevronDown, FileText, GitBranch, Mail, MapPin, NotebookPen, Pencil, Phone, Plus, Sparkles, Tag, Trash2, UserPlus, Users, Video } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { ApplicationForm } from '@/features/applications';
import { CandidateCv, CandidateForm } from '@/features/candidates';
import { DocumentsCard } from '@/features/documents';
import { ApplicationHistory, HistoryTimeline, documentItem, isCompletedStage, meetingItem, stageColors, type HistoryItem } from '@/features/pipelines';
import { TONES } from '@/features/pipelines/stage-colors';
import { useApplications, useCreateApplication } from '@/hooks/use-applications';
import { useCalendarEvents } from '@/hooks/use-calendar';
import { useCandidate, useDeleteCandidate, useUpdateCandidate } from '@/hooks/use-candidates';
import { useDocuments, useUploadDocument } from '@/hooks/use-documents';
import { useInterviewsFor } from '@/hooks/use-interviews';
import { usePhones } from '@/hooks/use-phones';
import { usePlacements } from '@/hooks/use-placements';
import { toFormDefaults } from '@/lib/form-defaults';
import { PLACEMENT_STATUS_COLOUR, REVIEW_STATUS_COLOUR, employmentTypeColour } from '@/lib/status-colors';
import type { ApplicationWithRelations } from '@/services/applications.service';
import type { PlacementWithRelations } from '@/services/placements.service';
import { listStageNotes } from '@/services/stage-notes.service';

const REVIEW_STATUS_VARIANT = REVIEW_STATUS_COLOUR;
const REVIEW_STATUS_LABEL = { PENDING: 'Pending', ACTIVE: 'Active', REJECTED: 'Rejected', REAPPLIED: 'Active', SUGGESTED: 'Rejected' } as const;
const PLACEMENT_STATUS_VARIANT = PLACEMENT_STATUS_COLOUR;

const date = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function Fact({ label: name, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" /> : null}
      <div>
        <dt className="text-xs text-foreground/50">{name}</dt>
        <dd className="text-sm">{value === null || value === undefined || value === '' ? '—' : value}</dd>
      </div>
    </div>
  );
}

/**
 * How an application stands, for the History of a candidate who may have applied to several jobs: accepted (hired —
 * whether still employed, finished or let go later), not accepted, or still in the process.
 */
function applicationOutcome(application: ApplicationWithRelations): { label: string; variant: 'success' | 'destructive' | 'slate' | 'default' } {
  const stage = application.pipelineStage;
  if (stage.type === 'PLACED') return { label: 'Accepted', variant: 'success' };
  if (isCompletedStage(stage)) return { label: 'Accepted · contract completed', variant: 'slate' };
  if (stage.type === 'REJECTED') {
    const reason = application.stageNotes?.find((n) => n.pipelineStageId === stage.id)?.fields?.reason;
    return reason === 'Terminated' ? { label: 'Accepted · contract terminated', variant: 'destructive' } : { label: 'Not accepted', variant: 'destructive' };
  }
  return { label: 'In process', variant: 'default' };
}

/** Whole months between two dates, as "1 yr 3 mo" / "5 mo" / "< 1 mo". */
function duration(from: string, to: string | null) {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
  if (months < 1) return '< 1 mo';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? `${years} yr` : '', rest ? `${rest} mo` : ''].filter(Boolean).join(' ');
}

function Tile({ value, label: name, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className={cn('text-xl font-semibold tabular-nums', tone)}>{value}</p>
      <p className="text-xs text-foreground/50">{name}</p>
    </div>
  );
}

/**
 * The candidate's track record at a glance, above the per-job History: how many times they applied and to how many
 * different jobs, how many applications ended in a rejection (with the reason written then), how many are still open
 * or accepted, the work they did before (every employment, with how long it lasted), and the applications grouped by
 * job — the same job applied for twice shows as two.
 */
function TrackRecord({ applications, placements }: { applications: ApplicationWithRelations[]; placements: PlacementWithRelations[] }) {
  const outcomes = applications.map((application) => ({ application, outcome: applicationOutcome(application) }));
  const count = (text: string) => outcomes.filter((o) => o.outcome.label === text).length;
  const terminated = count('Accepted · contract terminated');
  // every time a card was put in a Rejected stage, counted from its record of moves — an application that was
  // rejected, reconsidered and rejected again counts twice (same query key as the History blocks below: no extra load)
  const records = useQueries({
    queries: applications.map((application) => ({
      queryKey: ['applications', 'stage-notes', application.id],
      queryFn: () => listStageNotes(application.id),
    })),
  });
  const rejections = new Map<string, number>();
  applications.forEach((application, index) => {
    const record = records[index]?.data;
    const times = record
      ? record.moves.filter((m) => (m.kind === 'moved' || m.kind === 'added') && record.stages.find((s) => s.stage.id === m.toStageId)?.stage.type === 'REJECTED').length
      : 0;
    const endedTerminated = outcomes[index]?.outcome.label === 'Accepted · contract terminated';
    rejections.set(application.id, Math.max(0, times - (endedTerminated ? 1 : 0)));
  });
  const rejected = [...rejections.values()].reduce((sum, n) => sum + n, 0);
  const notAccepted = count('Not accepted');
  const inProcess = count('In process');
  const accepted = outcomes.length - notAccepted - inProcess - terminated;

  const byJob = new Map<string, { jobId: string; title: string; company: string; items: typeof outcomes }>();
  for (const entry of outcomes) {
    const job = entry.application.job;
    const group = byJob.get(job.id) ?? { jobId: job.id, title: job.title, company: job.company.name, items: [] };
    group.items.push(entry);
    byJob.set(job.id, group);
  }
  const latest = (items: typeof outcomes) => Math.max(...items.map((i) => +new Date(i.application.appliedAt)));
  const groups = [...byJob.values()].sort((a, b) => latest(b.items) - latest(a.items));
  if (applications.length === 0 && placements.length === 0) return null;
  const worked = [...placements].sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));

  return (
    <section className="rounded-lg border border-border" data-testid="candidate-track-record">
      <div className="rounded-t-lg border-b border-border bg-accent/30 px-3 py-2">
        <p className="text-sm font-semibold">
          Track record <span className="font-normal text-foreground/60">· everything this person has applied for and done</span>
        </p>
      </div>
      <div className="flex flex-col gap-4 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="track-record-tiles">
          <Tile value={applications.length} label="Applications" />
          <Tile value={groups.length} label={groups.length === 1 ? 'Different job' : 'Different jobs'} />
          <Tile value={rejected} label={rejected === 1 ? 'Time rejected' : 'Times rejected'} tone={rejected ? 'text-red-600' : undefined} />
          <Tile value={inProcess} label="In process" />
          <Tile value={accepted} label="Accepted" tone={accepted ? 'text-emerald-600' : undefined} />
          <Tile value={placements.length} label={placements.length === 1 ? 'Job worked' : 'Jobs worked'} />
        </div>
        {terminated > 0 ? (
          <p className="text-xs text-red-600">
            {terminated} contract{terminated === 1 ? ' was' : 's were'} terminated after the person was hired.
          </p>
        ) : null}

        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/50">Work done before</h4>
          {worked.length === 0 ? (
            <p className="text-sm text-foreground/50">No job worked through the platform yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm" data-testid="track-record-work">
              {worked.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <Link href={`/jobs/${p.job.id}`} className="font-medium hover:underline">
                      {p.job.title}
                    </Link>{' '}
                    <span className="text-foreground/60">
                      at{' '}
                      <Link href={`/companies/${p.company.id}`} className="hover:underline">
                        {p.company.name}
                      </Link>
                    </span>
                    <p className="text-xs text-foreground/50">
                      {date(p.startDate)} – {p.endDate ? date(p.endDate) : 'present'} · {duration(p.startDate, p.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={employmentTypeColour(p.employmentType)}>{p.employmentType === 'TEMPORARY' ? 'Temporary' : 'Permanent'}</Badge>
                    <Badge variant={PLACEMENT_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/50">Applications by job</h4>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm" data-testid="track-record-jobs">
            {groups.map((group) => (
              <li key={group.jobId} className="px-3 py-2" data-testid="track-record-job">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <Link href={`/jobs/${group.jobId}`} className="font-medium hover:underline">
                      {group.title}
                    </Link>{' '}
                    <span className="text-foreground/60">· {group.company}</span>
                  </p>
                  <Badge variant={group.items.length > 1 ? 'warning' : 'outline'}>
                    {group.items.length} application{group.items.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-foreground/60">
                  {[...group.items]
                    .sort((a, b) => +new Date(b.application.appliedAt) - +new Date(a.application.appliedAt))
                    .map(({ application, outcome }) => {
                      const why =
                        outcome.label === 'Not accepted'
                          ? application.stageNotes?.find((n) => n.pipelineStageId === application.pipelineStage.id)?.notes
                          : null;
                      return (
                        <li key={application.id} className="flex flex-wrap items-center gap-x-2">
                          <span>{date(application.appliedAt)}</span>
                          <Badge variant={outcome.variant}>{outcome.label}</Badge>
                          <span>{application.pipelineStage.name}</span>
                          {(rejections.get(application.id) ?? 0) > 0 ? (
                            <Badge variant="destructive">
                              Rejected {rejections.get(application.id)}×
                            </Badge>
                          ) : null}
                          {why ? <span className="italic">— “{why.length > 140 ? `${why.slice(0, 140)}…` : why}”</span> : null}
                        </li>
                      );
                    })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * One job the candidate applied for, as a block of History. The heading says which job, where, how it stands and
 * when they applied — the job and the company are links to their pages, "Open in pipeline" opens the card, and a
 * click anywhere else on the heading folds the block away or opens it again.
 */
function JobHistory({ application, number, children }: { application: ApplicationWithRelations; number: number; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const outcome = applicationOutcome(application);
  return (
    <section className="rounded-lg border border-border shadow-sm" data-testid="candidate-history-application">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={open ? 'Hide this job’s history' : 'Show this job’s history'}
        className={cn('flex cursor-pointer flex-wrap items-center justify-between gap-2 bg-accent/30 px-3 py-2.5 hover:bg-accent/50', open ? 'rounded-t-lg border-b border-border' : 'rounded-lg')}
        data-testid="candidate-history-toggle"
        onClick={(e) => !(e.target as HTMLElement).closest('a') && setOpen((shown) => !shown)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('a')) {
            e.preventDefault();
            setOpen((shown) => !shown);
          }
        }}
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-foreground/50 transition-transform', !open && '-rotate-90')} />
            <span className="rounded bg-foreground/80 px-1.5 py-0.5 text-xs font-semibold text-background">Job {number}</span>
            <Link href={`/jobs/${application.job.id}`} className="font-semibold text-primary hover:underline" title="Open the job">
              {application.job.title}
            </Link>
            <span className="text-foreground/40">at</span>
            <Link href={`/companies/${application.job.company.id}`} className="font-medium text-primary hover:underline" title="Open the company">
              {application.job.company.name}
            </Link>
          </p>
          <p className="mt-0.5 pl-6 text-xs text-foreground/50">Applied {new Date(application.appliedAt).toLocaleDateString([], { dateStyle: 'medium' })}</p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={outcome.variant} data-testid="candidate-history-outcome">
            {outcome.label}
          </Badge>
          <Badge variant={stageColors(application.pipelineStage).badge}>{application.pipelineStage.name}</Badge>
          <Link
            href={`/pipeline?pipelineId=${application.pipelineId}&candidateId=${application.candidate.id}&open=${application.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
          >
            <GitBranch className="h-3.5 w-3.5" /> Open in pipeline
          </Link>
        </span>
      </div>
      {open ? <div className="p-3">{children}</div> : null}
    </section>
  );
}

/**
 * The candidate's whole file: profile and potential, every application with its stage-by-stage record, interviews,
 * employment (placements), documents / CV, and their numbers on the calling list.
 */
export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;

  // Once the delete starts, stop refetching this candidate (the invalidation would otherwise 404 on the way out).
  const [deleting, setDeleting] = useState(false);
  const { data: candidate, isLoading } = useCandidate(deleting ? undefined : candidateId);
  const { data: applications } = useApplications({ candidateId, pageSize: 50 });
  const { data: placements } = usePlacements({ candidateId, pageSize: 20 });
  const uploadDocument = useUploadDocument();
  const { data: interviews } = useInterviewsFor({ candidateId });
  // for History: everything uploaded for this person and every meeting put on the calendar with them
  const { data: documents } = useDocuments({ candidateId, pageSize: 100 });
  const { data: calendar } = useCalendarEvents({ candidateId, pageSize: 100 });
  const { data: phones } = usePhones({ candidateId, pageSize: 10 });

  const router = useRouter();
  const updateCandidate = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  const createApplication = useCreateApplication();

  const [editOpen, setEditOpen] = useState(false);

  // History, the part that is not about one job: the person being added, and the documents and meetings that carry
  // no job (a CV uploaded on its own, a call booked before any application).
  const jobIds = new Set((applications?.items ?? []).map((a) => a.job.id));
  const applicationIds = new Set((applications?.items ?? []).map((a) => a.id));
  const generalHistory: HistoryItem[] = [
    ...(candidate
      ? [
          {
            key: 'added',
            at: new Date(candidate.createdAt).getTime(),
            tone: TONES.blue,
            icon: <UserPlus className="h-3.5 w-3.5" />,
            title: 'Added to the CRM',
          },
        ]
      : []),
    ...(documents?.items ?? [])
      .filter((d) => !(d.applicationId && applicationIds.has(d.applicationId)) && !(d.jobId && jobIds.has(d.jobId)))
      .map(documentItem),
    ...(calendar?.items ?? [])
      .filter((e) => !(e.application?.id && applicationIds.has(e.application.id)) && !(e.jobId && jobIds.has(e.jobId)))
      .map(meetingItem),
  ];

  // Arriving from a notification (see lib/notification-target.ts): "?edit=1" opens the Edit form straight away, and
  // "#employment" / "#journey" scroll to that card — once the candidate is on screen, since the cards load with them.
  const wantsEdit = useSearchParams().get('edit') === '1';
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (landed || !candidate) return;
    setLanded(true);
    if (wantsEdit) setEditOpen(true);
    const anchor = window.location.hash.slice(1);
    if (!anchor) return;
    // The cards above the target fill in as their data arrives and push it down, so one scroll is not enough: it is
    // repeated while the page is still growing — for a few seconds at most, and never once the user scrolls themselves.
    const scroll = () => document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    const growth = new ResizeObserver(scroll);
    const stop = () => {
      growth.disconnect();
      for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.removeEventListener(type, stop);
    };
    requestAnimationFrame(scroll);
    growth.observe(document.body);
    for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(type, stop, { passive: true });
    setTimeout(stop, 4000);
  }, [candidate, landed, wantsEdit]);
  const [addApplicationOpen, setAddApplicationOpen] = useState(false);

  async function handleDelete() {
    if (!candidate) return;
    if (!window.confirm(`Delete ${candidate.firstName} ${candidate.lastName}? Their applications leave the pipeline too.`)) return;
    setDeleting(true);
    try {
      await deleteCandidate.mutateAsync(candidate.id);
      router.push('/candidates');
    } catch (error) {
      setDeleting(false);
      throw error;
    }
  }

  if (isLoading || !candidate) {
    return <p className="text-sm text-foreground/60">Loading…</p>;
  }

  // what the potential score is missing — the same signals the API scores
  const missing = [
    !candidate.jobTitle && 'job title',
    !candidate.currentCompany && 'current employer',
    !candidate.email && 'e-mail',
    !candidate.phone && 'phone',
    !candidate.location && 'location',
  ].filter(Boolean) as string[];
  const tags = candidate.candidateTags?.map((t) => t.tag.name) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/candidates" className="inline-flex w-fit items-center gap-1 text-sm text-foreground/60 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to candidates
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent">
            <Users className="h-6 w-6 text-foreground/50" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {candidate.firstName} {candidate.lastName}
              </h2>
              {/* same Active / Rejected / Pending status as the Candidates table (read off the pipeline) */}
              <Badge variant={REVIEW_STATUS_VARIANT[candidate.reviewStatus]}>{REVIEW_STATUS_LABEL[candidate.reviewStatus]}</Badge>
              {candidate.currentApplication ? <Badge variant="outline">Stage: {candidate.currentApplication.stage}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={deleteCandidate.isPending} aria-label="Delete candidate">
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="candidate-profile">
            <Fact
              label="Email"
              value={
                candidate.email ? (
                  <a href={`mailto:${candidate.email}`} className="text-primary hover:underline">
                    {candidate.email}
                  </a>
                ) : null
              }
              icon={Mail}
            />
            <Fact
              label="Phone"
              value={
                candidate.phone ? (
                  <a href={`tel:${candidate.phone}`} className="text-primary hover:underline">
                    {candidate.phone}
                  </a>
                ) : null
              }
              icon={Phone}
            />
            <Fact label="Location" value={candidate.location} icon={MapPin} />
            <Fact label="Current / last job" value={candidate.jobTitle} icon={Briefcase} />
            <Fact label="Current / last employer" value={candidate.currentCompany} icon={Building2} />
            <Fact
              label="Interested in"
              value={
                candidate.interestedJob ? (
                  <Link href={`/jobs/${candidate.interestedJob.id}`} className="text-primary hover:underline">
                    {candidate.interestedJob.title}
                    {candidate.interestedJob.company ? ` · ${candidate.interestedJob.company.name}` : ''}
                  </Link>
                ) : null
              }
            />
            <Fact label="Source" value={candidate.source} />
            <Fact label="Record status" value={label(candidate.status)} />
            <Fact label="Added" value={date(candidate.createdAt)} />
            <Fact label="Last updated" value={date(candidate.updatedAt)} />
            <Fact label="Tags" value={tags.length ? tags.join(', ') : null} icon={Tag} />
            <Fact
              label="Potential"
              value={
                <>
                  {candidate.potentialLabel} · {candidate.potentialScore}%
                  <span className="block text-xs text-foreground/50">{missing.length ? `Missing: ${missing.join(', ')}` : 'Profile complete'}</span>
                </>
              }
              icon={Sparkles}
            />
          </dl>
        </CardContent>
      </Card>

      {/* the same History the pipeline's stage pop-up shows, here on the candidate's own page — one block per job applied
          for, each saying how it stands (accepted / not accepted / in process) */}
      {/* (id "journey": where a "new candidate" notification lands) */}
        <Card id="journey" className="scroll-mt-20" data-testid="candidate-history">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4 text-foreground/50" />
              History ({applications?.items.length ?? 0} job{applications?.items.length === 1 ? '' : 's'})
            </CardTitle>
            <Button type="button" size="sm" onClick={() => setAddApplicationOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Apply to another job
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!applications || applications.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-foreground/50">Not on any pipeline yet.</p>
            ) : null}
            <TrackRecord applications={applications?.items ?? []} placements={placements?.items ?? []} />
            <section className="rounded-lg border border-border" data-testid="candidate-history-general">
              <div className="rounded-t-lg border-b border-border bg-accent/30 px-3 py-2">
                <p className="text-sm font-semibold">
                  General <span className="font-normal text-foreground/60">· not about one job</span>
                </p>
              </div>
              <div className="p-3">
                <HistoryTimeline items={generalHistory} empty="Nothing yet." />
              </div>
            </section>
            {(applications?.items ?? []).map((application, index) => (
              <JobHistory key={application.id} application={application} number={index + 1}>
                <ApplicationHistory
                  application={application}
                  documents={(documents?.items ?? []).filter((d) => d.applicationId === application.id || d.jobId === application.job.id)}
                  interviews={(interviews ?? []).filter((i) => i.applicationId === application.id)}
                  // (a Zoom interview puts its own slot on the calendar: that one is already listed as the interview)
                  meetings={(calendar?.items ?? []).filter(
                    (e) =>
                      (e.application?.id === application.id || e.jobId === application.job.id) &&
                      !(interviews ?? []).some((i) => i.applicationId === application.id && new Date(i.scheduledAt).getTime() === new Date(e.startAt).getTime()),
                  )}
                  placement={placements?.items.find((p) => p.jobId === application.job.id)}
                />
              </JobHistory>
            ))}
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-foreground/50" /> Interviews ({interviews?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {interviews && interviews.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {interviews.map((i) => (
                  <li key={i.id} className="py-2">
                    <p className="font-medium">
                      {new Date(i.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {i.duration} min
                      {i.application ? ` · ${i.application.job.title}` : ''}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {i.interviewer ? `With ${i.interviewer.firstName} ${i.interviewer.lastName}` : 'Interviewer not set'}
                      {i.inviteSentAt ? ` · invitation sent to ${i.inviteSentTo}` : ' · invitation not sent'}
                      {i.meetingUrl ? (
                        <>
                          {' · '}
                          <a href={i.meetingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Zoom link
                          </a>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No interviews yet — schedule one from their pipeline card.</p>
            )}
          </CardContent>
        </Card>

        <Card id="employment" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-foreground/50" /> Employment ({placements?.totalItems ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {placements && placements.items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {placements.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link href={`/companies/${p.company.id}`} className="font-medium hover:underline">
                        {p.company.name}
                      </Link>
                      <p className="text-xs text-foreground/50">
                        <Link href={`/jobs/${p.job.id}`} className="hover:underline">
                          {p.job.title}
                        </Link>
                        {' · '}since {date(p.startDate)}
                        {p.endDate ? ` · until ${date(p.endDate)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={employmentTypeColour(p.employmentType)}>{p.employmentType === 'TEMPORARY' ? 'Temporary' : 'Permanent'}</Badge>
                      <Badge variant={PLACEMENT_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">Not placed anywhere yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-foreground/50" /> CV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CandidateCv candidateId={candidateId} />
          </CardContent>
        </Card>

        <DocumentsCard title="Other documents" owner={{ candidateId }} skip={(d) => d.type === 'CV' || d.type === 'RESUME'} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-foreground/50" /> On the calling list ({phones?.totalItems ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phones && phones.items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {phones.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link href="/phones" className="font-medium tabular-nums hover:underline">
                        {p.normalizedPhone}
                      </Link>
                      <p className="text-xs text-foreground/50">
                        {p.callCount} call{p.callCount === 1 ? '' : 's'} · last {p.lastCallAt ? new Date(p.lastCallAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'never'}
                      </p>
                    </div>
                    <Badge variant="outline">{p.source ?? 'Phones'}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">Not on any imported calling list (matched by e-mail on import).</p>
            )}
          </CardContent>
        </Card>
      </div>

      {editOpen ? (
        <Dialog open onOpenChange={setEditOpen} title="Edit candidate">
          <CandidateForm
            defaultValues={toFormDefaults(candidate)}
            submitLabel="Save changes"
            onSubmit={async (values, resume) => {
              await updateCandidate.mutateAsync({ id: candidate.id, input: values });
              if (resume) {
                await uploadDocument
                  .mutateAsync({ file: resume, type: 'CV', candidateId: candidate.id })
                  .catch(() => window.alert('The changes were saved, but the CV could not be saved — use Upload CV.'));
              }
              setEditOpen(false);
            }}
          />
        </Dialog>
      ) : null}

      {addApplicationOpen ? (
        <Dialog open onOpenChange={setAddApplicationOpen} title="Apply to another job">
          <ApplicationForm
            defaultValues={{ candidateId: candidate.id }}
            submitLabel="Create application"
            onSubmit={async (values) => {
              await createApplication.mutateAsync(values);
              setAddApplicationOpen(false);
            }}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
