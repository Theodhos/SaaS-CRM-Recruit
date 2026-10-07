'use client';

import { Button, Label, Select, SearchSelect } from '@crm/ui';
import { createApplicationSchema, type CreateApplicationInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useCandidates } from '@/hooks/use-candidates';
import { useJobs } from '@/hooks/use-jobs';
import { usePipelines } from '@/hooks/use-pipelines';

const STATUS_OPTIONS = ['ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'PLACED'] as const;
const SOURCE_OPTIONS = [
  'SOURCED', 'INBOUND', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'CAREER_SITE', 'OTHER',
] as const;

export interface ApplicationFormProps {
  defaultValues?: Partial<CreateApplicationInput>;
  submitLabel: string;
  onSubmit: (values: CreateApplicationInput) => Promise<void>;
}

export function ApplicationForm({ defaultValues, submitLabel, onSubmit }: ApplicationFormProps) {
  // Note: a locked/disabled <select> would look right but react-hook-form
  // drops disabled fields from the submitted values entirely — so a
  // pre-selected candidate/job (from a detail page's "Add Application"
  // button) stays editable rather than silently vanishing on submit.
  const { data: candidates } = useCandidates({ pageSize: 100 });
  const { data: jobs } = useJobs({ pageSize: 100 });
  const { data: pipelines } = usePipelines();
  const stages = pipelines?.[0]?.stages ?? [];
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateApplicationInput>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues,
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="candidateId">Candidate</Label>
        <SearchSelect id="candidateId" {...register('candidateId')}>
          <option value="">Select a candidate…</option>
          {candidates?.items.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.firstName} {candidate.lastName}
            </option>
          ))}
        </SearchSelect>
        {errors.candidateId ? (
          <p className="text-xs text-destructive">{errors.candidateId.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="jobId">Job</Label>
        <SearchSelect id="jobId" {...register('jobId')}>
          <option value="">Select a job…</option>
          {jobs?.items.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
              {job.company ? ` — ${job.company.name}` : ''}
            </option>
          ))}
        </SearchSelect>
        {errors.jobId ? <p className="text-xs text-destructive">{errors.jobId.message}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pipelineStageId">Pipeline stage</Label>
        <Select id="pipelineStageId" {...register('pipelineStageId')}>
          <option value="">Keep current stage</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.order}. {stage.name}
              {stage.type === 'PLACED' ? ' — auto-creates a Placement' : ''}
            </option>
          ))}
        </Select>
        <p className="text-xs text-foreground/50">
          Moving this to a &quot;Placed&quot;-type stage automatically creates the Placement
          (candidate + job + company) — no separate step needed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register('status')}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">Source</Label>
          <Select id="source" {...register('source')}>
            {SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>
                {source.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
