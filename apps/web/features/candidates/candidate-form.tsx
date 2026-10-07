'use client';

import { Button, Input, quickFieldControlClass, quickFieldSelectClass, QuickField, SearchSelect } from '@crm/ui';
import { createCandidateSchema, type CreateCandidateInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Building2, Loader2, Mail, MapPin, Phone, Tag, Target, User } from 'lucide-react';
import type { ChangeEvent, DragEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useJobs } from '@/hooks/use-jobs';
import { parseResume } from '@/services/candidates.service';

/** Add Candidate: new arrivals go straight onto the pipeline of the job they want, so that job must be chosen. */
const requireInterestedJobSchema = createCandidateSchema.superRefine((values, ctx) => {
  if (!values.interestedJobId) {
    ctx.addIssue({ code: 'custom', path: ['interestedJobId'], message: 'Choose the job this candidate wants — they go straight onto its pipeline.' });
  }
});

const RESUME_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'location',
  'jobTitle',
  'currentCompany',
] as const;
const RESUME_ACCEPT = '.pdf,.docx,.txt';

export interface CandidateFormProps {
  defaultValues?: Partial<CreateCandidateInput>;
  /** `resume`: the file dropped into the form, to keep with the candidate as their CV. */
  onSubmit: (values: CreateCandidateInput, resume?: File) => Promise<void>;
  submitLabel: string;
  /** Insist on an "Interested job" (Add Candidate) — see requireInterestedJobSchema. */
  requireInterestedJob?: boolean;
}

export function CandidateForm({ defaultValues, onSubmit, submitLabel, requireInterestedJob = false }: CandidateFormProps) {
  const schema = useMemo(() => (requireInterestedJob ? requireInterestedJobSchema : createCandidateSchema), [requireInterestedJob]);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCandidateInput>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { data: jobs } = useJobs({ pageSize: 100, status: 'OPEN' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // kept even when scanning finds nothing: the file is still the candidate's CV
  const resumeFile = useRef<File | undefined>(undefined);
  const [isDragActive, setIsDragActive] = useState(false);
  const [resumeState, setResumeState] = useState<
    { status: 'idle' } | { status: 'scanning'; fileName: string } | { status: 'done'; fileName: string; filledCount: number } | { status: 'error'; message: string }
  >({ status: 'idle' });

  const isScanning = resumeState.status === 'scanning';

  async function handleResumeFile(file: File) {
    resumeFile.current = file;
    setResumeState({ status: 'scanning', fileName: file.name });
    try {
      const parsed = await parseResume(file);
      let filledCount = 0;
      for (const field of RESUME_FIELDS) {
        const value = parsed[field];
        if (value) {
          setValue(field, value, { shouldDirty: true, shouldValidate: true });
          filledCount += 1;
        }
      }
      setResumeState({ status: 'done', fileName: file.name, filledCount });
    } catch (error) {
      setResumeState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to scan résumé.',
      });
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void handleResumeFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (isScanning) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleResumeFile(file);
  }

  return (
    <form className="flex flex-col" onSubmit={handleSubmit((values) => onSubmit(values, resumeFile.current))} noValidate>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isScanning && fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isScanning) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragActive ? 'border-primary bg-accent' : 'border-input'
        } ${isScanning ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={RESUME_ACCEPT}
          className="hidden"
          onChange={handleFileInputChange}
        />
        {isScanning ? (
          <Loader2 className="mb-1 h-5 w-5 animate-spin text-foreground/40" />
        ) : null}
        <p className="text-xs font-bold uppercase tracking-wide">Drag and drop résumé here</p>
        <p className="text-xs text-foreground/60">or click to upload</p>
        <p className="mt-1 text-[11px] text-foreground/40">(Upload only PDF, DOCX or TXT)</p>
      </div>
      {resumeState.status === 'done' ? (
        <p className="mt-1.5 text-xs text-foreground/60">
          {resumeState.filledCount > 0
            ? `Filled ${resumeState.filledCount} field(s) from ${resumeState.fileName}. Review before saving.`
            : `Couldn't find recognizable fields in ${resumeState.fileName} — fill them in manually.`}
        </p>
      ) : null}
      {resumeState.status === 'error' ? (
        <p className="mt-1.5 text-xs text-destructive">{resumeState.message}</p>
      ) : null}

      <div className="mt-2 flex flex-col">
        <QuickField icon={User} label="First name" htmlFor="firstName" required error={errors.firstName?.message}>
          <Input id="firstName" className={quickFieldControlClass} {...register('firstName')} />
        </QuickField>

        <QuickField icon={User} label="Last name" htmlFor="lastName" required error={errors.lastName?.message}>
          <Input id="lastName" className={quickFieldControlClass} {...register('lastName')} />
        </QuickField>

        <QuickField icon={Mail} label="Primary email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" className={quickFieldControlClass} {...register('email')} />
        </QuickField>

        <QuickField icon={Phone} label="Phone" htmlFor="phone">
          <Input id="phone" className={quickFieldControlClass} {...register('phone')} />
        </QuickField>

        <QuickField icon={MapPin} label="Location" htmlFor="location">
          <Input id="location" className={quickFieldControlClass} {...register('location')} />
        </QuickField>

        <QuickField icon={Briefcase} label="Job title" htmlFor="jobTitle">
          <Input id="jobTitle" className={quickFieldControlClass} {...register('jobTitle')} />
        </QuickField>

        <QuickField icon={Building2} label="Employer" htmlFor="currentCompany">
          <Input id="currentCompany" className={quickFieldControlClass} {...register('currentCompany')} />
        </QuickField>

        <QuickField icon={Target} label="Interested job" htmlFor="interestedJobId" required={requireInterestedJob} error={errors.interestedJobId?.message}>
          <SearchSelect id="interestedJobId" className={quickFieldSelectClass} {...register('interestedJobId')}>
            <option value="">{requireInterestedJob ? 'Choose the job they want…' : 'Not tied to a specific job yet'}</option>
            {jobs?.items.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.company ? ` — ${job.company.name}` : ''}
              </option>
            ))}
          </SearchSelect>
        </QuickField>

        <QuickField icon={Tag} label="Source" htmlFor="source">
          <Input id="source" placeholder="Referral, LinkedIn, …" className={quickFieldControlClass} {...register('source')} />
        </QuickField>

      </div>

      <div className="sticky bottom-0 -mx-5 mt-2 flex items-center justify-end gap-2 border-t border-border bg-primary px-5 py-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-background text-foreground hover:bg-background/90"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
