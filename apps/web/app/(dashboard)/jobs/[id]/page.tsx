'use client';

import type { Job } from '@crm/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog } from '@crm/ui';
import { ArrowLeft, Briefcase, Building2, CalendarClock, ClipboardCheck, FileText, GitBranch, Gift, Globe, GraduationCap, ListChecks, Mail, MapPin, Pencil, Phone, Plus, Users, Video, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EditableTextCard } from '@/components/editable-text-card';
import { ApplicationForm } from '@/features/applications';
import { PersonDialog } from '@/features/companies/person-dialog';
import { rankTitle } from '@/features/companies/structure';
import { DocumentsCard } from '@/features/documents';
import { JobForm, experienceLabel } from '@/features/jobs';
import { StageStatusBadge, latestPay } from '@/features/pipelines';
import { useApplications, useCreateApplication } from '@/hooks/use-applications';
import { useCandidates } from '@/hooks/use-candidates';
import { useContacts } from '@/hooks/use-contacts';
import { useDocuments } from '@/hooks/use-documents';
import { useInterviewsFor } from '@/hooks/use-interviews';
import { useJob, useUpdateJob } from '@/hooks/use-jobs';
import { usePlacements } from '@/hooks/use-placements';
import { toFormDefaults } from '@/lib/form-defaults';
import { JOB_STATUS_COLOUR, PLACEMENT_STATUS_COLOUR, POTENTIAL_COLOUR, employmentTypeColour } from '@/lib/status-colors';
import type { ApplicationWithRelations } from '@/services/applications.service';
import type { ContactWithCompany } from '@/services/contacts.service';

const JOB_STATUS_VARIANT = JOB_STATUS_COLOUR;
const PLACEMENT_STATUS_VARIANT = PLACEMENT_STATUS_COLOUR;
const POTENTIAL_VARIANT = POTENTIAL_COLOUR;

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const money = (value: string | number | null | undefined, currency: string) =>
  value === null || value === undefined ? null : new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));
const date = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

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

/** The client's people, ranked (CEO first) — click a person for everything on file about them. */
function CompanyPeople({ companyId, onSelect }: { companyId: string; onSelect: (person: ContactWithCompany) => void }) {
  const { data } = useContacts({ companyId, pageSize: 100 });
  const people = useMemo(() => [...(data?.items ?? [])].sort((a, b) => rankTitle(a.jobTitle).rank - rankTitle(b.jobTitle).rank || a.lastName.localeCompare(b.lastName)), [data]);
  if (people.length === 0) return <p className="text-sm text-foreground/50">No contacts recorded at this company yet.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {people.map((person) => (
        <li key={person.id}>
          <button type="button" onClick={() => onSelect(person)} className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs hover:border-primary/60 hover:bg-accent">
            <span className="block font-medium">
              {person.firstName} {person.lastName}
            </span>
            <span className="text-foreground/50">{person.jobTitle ?? rankTitle(person.jobTitle).group}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Everything about one job on one page: the terms (type, pay, location, dates, who runs it), the client and the
 * people there, who is working the job today (placements), who is where on the pipeline for it, the interviews
 * scheduled, the candidates interested in it, and its documents.
 */
export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const { data: job, isLoading } = useJob(jobId);
  const { data: applications } = useApplications({ jobId, pageSize: 100 });
  const { data: placements } = usePlacements({ jobId, pageSize: 50 });
  const { data: interested } = useCandidates({ interestedJobId: jobId, pageSize: 50 });
  const { data: documents } = useDocuments({ jobId, pageSize: 50 });
  const { data: interviews } = useInterviewsFor({ jobId });

  const updateJob = useUpdateJob();
  const createApplication = useCreateApplication();

  const [editOpen, setEditOpen] = useState(false);
  const [addApplicationOpen, setAddApplicationOpen] = useState(false);
  const [person, setPerson] = useState<ContactWithCompany | null>(null);

  /** One of the job's text sections, saved on its own. */
  const saveText = (input: Partial<Pick<Job, 'description' | 'responsibilities' | 'requirements' | 'compensationPackage'>>) =>
    updateJob.mutateAsync({ id: jobId, input: input as Parameters<typeof updateJob.mutateAsync>[0]['input'] });

  // the pipeline, stage by stage, for this job — and the pay agreed with applicants so far
  const byStage = useMemo(() => {
    const groups = new Map<string, { pipeline: string; stage: { name: string; type: string; order: number }; items: ApplicationWithRelations[] }>();
    for (const a of applications?.items ?? []) {
      const key = `${a.pipelineId}:${a.pipelineStage.id}`;
      const g = groups.get(key) ?? { pipeline: (a as ApplicationWithRelations & { pipeline?: { name: string } }).pipeline?.name ?? 'Pipeline', stage: a.pipelineStage, items: [] };
      g.items.push(a);
      groups.set(key, g);
    }
    return [...groups.values()].sort((x, y) => x.pipeline.localeCompare(y.pipeline) || x.stage.order - y.stage.order);
  }, [applications]);
  const payRange = useMemo(() => {
    const rates = (applications?.items ?? []).map((a) => latestPay(a)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (rates.length === 0) return null;
    const values = rates.map((p) => Number(p.hourlyRate));
    return { min: Math.min(...values), max: Math.max(...values), currency: rates[0]!.currency, count: rates.length };
  }, [applications]);

  if (isLoading || !job) {
    return <p className="text-sm text-foreground/60">Loading…</p>;
  }

  const salary = job.salaryMin || job.salaryMax ? [money(job.salaryMin, job.currency), money(job.salaryMax, job.currency)].filter(Boolean).join(' – ') : null;
  const experience = experienceLabel(job.experienceYearsMin, job.experienceYearsMax);
  const hired = placements?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/jobs" className="inline-flex w-fit items-center gap-1 text-sm text-foreground/60 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Briefcase className="h-6 w-6 text-foreground/50" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{job.title}</h2>
              <Badge variant={JOB_STATUS_VARIANT[job.status]}>{label(job.status)}</Badge>
              <Badge variant={employmentTypeColour(job.employmentType)}>{label(job.employmentType)}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-foreground/60">
              {job.company ? (
                <Link href={`/companies/${job.company.id}`} className="inline-flex items-center gap-1 hover:underline">
                  <Building2 className="h-3.5 w-3.5" />
                  {job.company.name}
                </Link>
              ) : (
                <span className="text-foreground/40">No company linked</span>
              )}
              {job.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              ) : null}
              {salary ? (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" />
                  {salary}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
          <Button type="button" onClick={() => setAddApplicationOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add applicant
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terms & key facts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="job-facts">
            <Fact label="Employment type" value={label(job.employmentType)} icon={Briefcase} />
            <Fact label="Salary" value={salary} icon={Wallet} />
            <Fact label="Location" value={job.location} icon={MapPin} />
            <Fact label="Experience required" value={experience} icon={GraduationCap} />
            <Fact label="Currency" value={job.currency} />
            <Fact label="Opened" value={date(job.openedAt)} icon={CalendarClock} />
            <Fact label={job.status === 'CLOSED' ? 'Closed' : 'Status'} value={job.status === 'CLOSED' ? date(job.closedAt) : label(job.status)} />
            <Fact label="Run by" value={job.owner ? `${job.owner.firstName} ${job.owner.lastName}` : 'Unassigned'} icon={Users} />
            <Fact
              label="Pay agreed so far"
              value={payRange ? `${money(payRange.min, payRange.currency)} – ${money(payRange.max, payRange.currency)} / h (${payRange.count} applicant${payRange.count === 1 ? '' : 's'})` : 'Nothing recorded yet'}
            />
            <Fact label="Applicants" value={applications?.totalItems ?? 0} />
            <Fact label="Working this job" value={hired.length} />
            <Fact label="Interested candidates" value={interested?.totalItems ?? 0} />
            <Fact label="Documents" value={documents?.totalItems ?? 0} icon={FileText} />
          </dl>
        </CardContent>
      </Card>

      {/* each of the four texts is edited in its own section: add to it, or take something out, and save */}
      <EditableTextCard
        testId="job-description"
        title="What the job is"
        icon={FileText}
        value={job.description}
        placeholder="What this job is about."
        emptyText="No description yet — use Add to say what the job is."
        onSave={(description) => saveText({ description })}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EditableTextCard
          testId="job-responsibilities"
          title="What the candidate will do"
          icon={ListChecks}
          asList
          value={job.responsibilities}
          placeholder="One duty per line."
          emptyText="No duties listed yet — use Add to list what the candidate will do."
          onSave={(responsibilities) => saveText({ responsibilities })}
        />

        <EditableTextCard
          testId="job-requirements"
          title="What is required"
          icon={ClipboardCheck}
          asList
          value={job.requirements}
          placeholder="One requirement per line."
          emptyText="No requirements listed yet — use Add to list what the job asks for."
          onSave={(requirements) => saveText({ requirements })}
        >
          <p className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 shrink-0 text-foreground/40" />
            <span className="text-foreground/50">Experience:</span>
            <span className="font-medium">{experience ?? 'Not set'}</span>
          </p>
        </EditableTextCard>
      </div>

      <EditableTextCard
        testId="job-pay-package"
        title="Pay package"
        icon={Gift}
        asList
        value={job.compensationPackage}
        placeholder="Bonus, benefits, leave — one per line."
        emptyText="No package details yet — use Add to add bonus, benefits and leave."
        onSave={(compensationPackage) => saveText({ compensationPackage })}
      >
        <p className="flex items-center gap-2 text-sm">
          <Wallet className="h-4 w-4 shrink-0 text-foreground/40" />
          <span className="text-foreground/50">Salary:</span>
          <span className="font-medium">{salary ?? 'Not set'}</span>
        </p>
      </EditableTextCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-foreground/50" /> The client
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {job.company ? (
              <>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Fact
                    label="Company"
                    value={
                      <Link href={`/companies/${job.company.id}`} className="font-medium text-primary hover:underline">
                        {job.company.name}
                      </Link>
                    }
                  />
                  <Fact label="Industry" value={job.company.industry} />
                  <Fact
                    label="Website"
                    value={
                      job.company.website ? (
                        <a href={job.company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {job.company.website}
                        </a>
                      ) : null
                    }
                    icon={Globe}
                  />
                  <Fact label="Email" value={job.company.email} icon={Mail} />
                  <Fact label="Phone" value={job.company.phone} icon={Phone} />
                  <Fact label="Where" value={[job.company.city, job.company.country].filter(Boolean).join(', ')} icon={MapPin} />
                </dl>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">People at the client (click for details)</p>
                  <CompanyPeople companyId={job.company.id} onSelect={setPerson} />
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground/50">Link a company in Edit to see its details and people here.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-foreground/50" /> Working this job ({hired.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hired.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border" data-testid="job-employees">
                {hired.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link href={`/candidates/${p.candidate.id}`} className="font-medium hover:underline">
                        {p.candidate.firstName} {p.candidate.lastName}
                      </Link>
                      <p className="text-xs text-foreground/50">
                        Since {date(p.startDate)}
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
              <p className="py-6 text-center text-sm text-foreground/50">Nobody placed on this job yet — the pipeline below shows who is on the way.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-foreground/50" /> Pipeline — who is where ({applications?.totalItems ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byStage.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="job-pipeline">
              {byStage.map((group) => (
                <div key={`${group.pipeline}:${group.stage.name}`} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">
                    {group.stage.order}. {group.stage.name}
                    <span className="ml-1 text-xs font-normal text-foreground/50">
                      · {group.pipeline} · {group.items.length}
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {group.items.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                        <Link href={`/candidates/${a.candidate.id}`} className="hover:underline">
                          {a.candidate.firstName} {a.candidate.lastName}
                        </Link>
                        <span className="flex items-center gap-1.5">
                          <StageStatusBadge application={a} stage={group.stage} />
                          <Link
                            href={`/pipeline?pipelineId=${a.pipelineId}&jobId=${job.id}${job.company ? `&companyId=${job.company.id}` : ''}&candidateId=${a.candidate.id}`}
                            className="text-foreground/40 hover:text-foreground"
                            aria-label="View in pipeline"
                          >
                            <GitBranch className="h-4 w-4" />
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-foreground/50">No candidates have applied to this job yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                    </p>
                    <p className="text-xs text-foreground/50">
                      {i.application ? (
                        <Link href={`/candidates/${i.application.candidate.id}`} className="hover:underline">
                          {i.application.candidate.firstName} {i.application.candidate.lastName}
                        </Link>
                      ) : null}
                      {i.interviewer ? ` · with ${i.interviewer.firstName} ${i.interviewer.lastName}` : ''}
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
              <p className="text-sm text-foreground/50">No interviews scheduled — schedule one from a pipeline card.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-foreground/50" /> Interested candidates ({interested?.totalItems ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {interested && interested.items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {interested.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      <p className="text-xs text-foreground/50">{[c.jobTitle, c.location].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <Badge variant={POTENTIAL_VARIANT[c.potentialLabel]}>
                      {c.potentialLabel} · {c.potentialScore}%
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">Nobody has chosen this job yet.</p>
            )}
          </CardContent>
        </Card>

        <DocumentsCard owner={{ jobId }} />
      </div>

      {person ? <PersonDialog person={person} onClose={() => setPerson(null)} /> : null}

      {editOpen ? (
        <Dialog open onOpenChange={setEditOpen} title="Edit job">
          <JobForm
            defaultValues={{
              ...toFormDefaults(job),
              salaryMin: job.salaryMin ? Number(job.salaryMin) : undefined,
              salaryMax: job.salaryMax ? Number(job.salaryMax) : undefined,
            }}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await updateJob.mutateAsync({ id: job.id, input: values });
              setEditOpen(false);
            }}
          />
        </Dialog>
      ) : null}

      {addApplicationOpen ? (
        <Dialog open onOpenChange={setAddApplicationOpen} title="Add applicant">
          <ApplicationForm
            defaultValues={{ jobId: job.id }}
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
