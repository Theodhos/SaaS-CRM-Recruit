'use client';

import { Button, Input, Label, Select, SearchSelect } from '@crm/ui';
import { createCalendarEventSchema, type CreateCalendarEventInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useCandidates } from '@/hooks/use-candidates';
import { useCompanies } from '@/hooks/use-companies';
import { useContacts } from '@/hooks/use-contacts';
import { useJobs } from '@/hooks/use-jobs';

const TYPE_OPTIONS = ['MEETING', 'INTERVIEW', 'CALL'] as const;
const STATUS_OPTIONS = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export interface EventFormProps {
  defaultValues?: Partial<CreateCalendarEventInput>;
  submitLabel: string;
  onSubmit: (values: CreateCalendarEventInput) => Promise<void>;
}

export function EventForm({ defaultValues, submitLabel, onSubmit }: EventFormProps) {
  const { data: candidates } = useCandidates({ pageSize: 100 });
  const { data: companies } = useCompanies({ pageSize: 100 });
  const { data: contacts } = useContacts({ pageSize: 100 });
  const { data: jobs } = useJobs({ pageSize: 100 });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCalendarEventInput>({
    resolver: zodResolver(createCalendarEventSchema),
    defaultValues,
  });
  const onPipeline = Boolean(watch('candidateId')) && Boolean(watch('meetingUrl')?.trim());

  // A <select> cannot show a value whose <option> has not arrived yet (the lists load after the form is on screen),
  // so the chosen candidate — e.g. from "Schedule a meeting" on a pipeline card — is applied again once it can be.
  const wantedCandidateId = defaultValues?.candidateId;
  useEffect(() => {
    if (wantedCandidateId && candidates?.items.some((c) => c.id === wantedCandidateId)) {
      setValue('candidateId', wantedCandidateId);
    }
  }, [wantedCandidateId, candidates, setValue]);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register('title')} />
        {errors.title ? <p className="text-xs text-destructive">{errors.title.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startAt">Starts</Label>
          <Input id="startAt" type="datetime-local" {...register('startAt')} />
          {errors.startAt ? <p className="text-xs text-destructive">{errors.startAt.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endAt">Ends</Label>
          <Input id="endAt" type="datetime-local" {...register('endAt')} />
          {errors.endAt ? <p className="text-xs text-destructive">{errors.endAt.message}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <Select id="type" {...register('type')}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register('status')}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...register('location')} placeholder="Office, address…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meetingUrl">Meeting link</Label>
          <Input id="meetingUrl" type="url" {...register('meetingUrl')} placeholder="https://zoom.us/j/… or https://meet.google.com/…" />
          {errors.meetingUrl ? <p className="text-xs text-destructive">{errors.meetingUrl.message}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="candidateId">Candidate</Label>
          <SearchSelect id="candidateId" {...register('candidateId')}>
            <option value="">—</option>
            {/* two people can have the same name, so each one is shown with what tells them apart */}
            {candidates?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
                {c.email || c.jobTitle ? ` — ${c.email || c.jobTitle}` : ''}
              </option>
            ))}
          </SearchSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactId">Contact</Label>
          <Select id="contactId" {...register('contactId')}>
            <option value="">—</option>
            {contacts?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyId">Company</Label>
          <SearchSelect id="companyId" {...register('companyId')}>
            <option value="">—</option>
            {companies?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SearchSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jobId">Job</Label>
          <SearchSelect id="jobId" {...register('jobId')}>
            <option value="">—</option>
            {jobs?.items.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </SearchSelect>
        </div>
      </div>

      <p className={`rounded-md border px-3 py-2 text-xs ${onPipeline ? 'border-sky-300 bg-sky-50 text-sky-950' : 'border-border text-foreground/60'}`} data-testid="event-pipeline-note">
        {onPipeline
          ? 'This meeting and its link will show on the candidate’s card on the pipeline, and in the card’s pop-up.'
          : 'Choose a candidate and add a meeting link, and the meeting shows on their pipeline card by itself.'}
      </p>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
