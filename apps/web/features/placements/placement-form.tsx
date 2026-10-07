'use client';

import { Button, Input, Label, Select, SearchSelect } from '@crm/ui';
import { createPlacementSchema, type CreatePlacementInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';

import { useCandidates } from '@/hooks/use-candidates';
import { useJobs } from '@/hooks/use-jobs';

const STATUS_OPTIONS = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
// CANCELLED is how the employment ended, but "Terminated" is what every button and filter calls it
const STATUS_LABEL: Record<(typeof STATUS_OPTIONS)[number], string> = { ACTIVE: 'Active', COMPLETED: 'Completed', CANCELLED: 'Terminated' };

export interface PlacementFormProps {
  defaultValues?: Partial<CreatePlacementInput>;
  submitLabel: string;
  onSubmit: (values: CreatePlacementInput, contractFile: File | null) => Promise<void>;
}

/** Manual "record a hire" form — the admin-override path alongside the automatic Placement created when an application reaches a "Placed"-type pipeline stage. Company defaults from the chosen job but stays editable, since not every job has a company yet. */
export function PlacementForm({ defaultValues, submitLabel, onSubmit }: PlacementFormProps) {
  const { data: candidates } = useCandidates({ pageSize: 100 });
  const { data: jobs } = useJobs({ pageSize: 100 });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreatePlacementInput>({
    resolver: zodResolver(createPlacementSchema),
    defaultValues,
  });

  const jobId = watch('jobId');
  const companyTouchedRef = useRef(Boolean(defaultValues?.companyId));

  // The selects are native and their options arrive after the form mounted, so the browser could not show the
  // default candidate / job / company at mount time — re-apply them once the options exist (editing a placement).
  useEffect(() => {
    if (!candidates || !jobs) return;
    for (const key of ['candidateId', 'jobId', 'companyId'] as const) {
      const wanted = defaultValues?.[key];
      if (wanted) setValue(key, wanted, { shouldDirty: false });
    }
  }, [candidates, jobs, defaultValues, setValue]);

  useEffect(() => {
    if (companyTouchedRef.current) return;
    const job = jobs?.items.find((j) => j.id === jobId);
    if (job?.company) setValue('companyId', job.company.id, { shouldValidate: true });
  }, [jobId, jobs, setValue]);

  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  return (
    <form
      className="flex flex-col gap-4"
      // an empty optional date input submits "" — the API wants it absent, not an invalid date
      onSubmit={handleSubmit((values) => onSubmit({ ...values, endDate: values.endDate || undefined }, file))}
      noValidate
    >
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
        <Label htmlFor="companyId">Company</Label>
        <SearchSelect id="companyId" {...register('companyId')} onChangeCapture={() => (companyTouchedRef.current = true)}>
          <option value="">Select a company…</option>
          {jobs?.items
            .map((j) => j.company)
            .filter((c): c is { id: string; name: string } => c !== null)
            .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
            .map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
        </SearchSelect>
        {errors.companyId ? <p className="text-xs text-destructive">{errors.companyId.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
          {errors.startDate ? <p className="text-xs text-destructive">{errors.startDate.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" type="date" {...register('endDate')} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employmentType">Employment type</Label>
        <Select id="employmentType" {...register('employmentType')}>
          <option value="PERMANENT">Permanent</option>
          <option value="TEMPORARY">Temporary</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select id="status" {...register('status')}>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contract-file">Contract / offer letter (optional)</Label>
        <Input id="contract-file" type="file" ref={fileInputRef} onChange={handleFileChange} />
        <p className="text-xs text-foreground/50">
          Stored as a legal backup copy with the employee&apos;s documents, linked to this placement.
        </p>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
