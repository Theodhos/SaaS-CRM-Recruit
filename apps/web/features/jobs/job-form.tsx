'use client';

import {
  Button,
  Input,
  QuickField,
  Select,
  Textarea,
  quickFieldControlClass,
  quickFieldSelectClass,
  SearchSelect,
} from '@crm/ui';
import { createJobSchema, type CreateJobInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Briefcase,
  Building2,
  ClipboardCheck,
  DollarSign,
  FileText,
  Gift,
  GraduationCap,
  ListChecks,
  MapPin,
  Tag,
} from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useCompanies } from '@/hooks/use-companies';

const STATUS_OPTIONS = ['OPEN', 'ON_HOLD', 'CLOSED'] as const;
const EMPLOYMENT_TYPE_OPTIONS = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME'] as const;
const textareaClass =
  'min-h-[70px] rounded-none border-0 bg-transparent px-0 text-sm shadow-none placeholder:italic placeholder:text-foreground/40 focus-visible:ring-0';

export interface JobFormProps {
  defaultValues?: Partial<CreateJobInput>;
  onSubmit: (values: CreateJobInput) => Promise<void>;
  submitLabel: string;
}

export function JobForm({ defaultValues, onSubmit, submitLabel }: JobFormProps) {
  const { data: companies } = useCompanies({ pageSize: 100 });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { currency: 'USD', ...defaultValues },
  });

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col">
        <QuickField icon={Building2} label="Company" htmlFor="companyId" error={errors.companyId?.message}>
          <SearchSelect id="companyId" className={quickFieldSelectClass} {...register('companyId')}>
            <option value="">No company (link later)</option>
            {companies?.items.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </SearchSelect>
        </QuickField>

        <QuickField icon={Building2} label="Or new company name" htmlFor="companyName">
          <Input
            id="companyName"
            placeholder="Not listed above?"
            className={quickFieldControlClass}
            {...register('companyName')}
          />
        </QuickField>

        <QuickField icon={Briefcase} label="Job title" htmlFor="title" required error={errors.title?.message}>
          <Input id="title" className={quickFieldControlClass} {...register('title')} />
        </QuickField>

        <QuickField icon={MapPin} label="Location" htmlFor="location">
          <Input id="location" className={quickFieldControlClass} {...register('location')} />
        </QuickField>

        <QuickField icon={Tag} label="Employment type" htmlFor="employmentType">
          <Select id="employmentType" className={quickFieldSelectClass} {...register('employmentType')}>
            {EMPLOYMENT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </QuickField>

        <QuickField icon={DollarSign} label="Salary range">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Salary min"
              type="number"
              placeholder="Min"
              className={quickFieldControlClass}
              {...register('salaryMin')}
            />
            <span className="text-foreground/30">–</span>
            <Input
              aria-label="Salary max"
              type="number"
              placeholder="Max"
              className={quickFieldControlClass}
              {...register('salaryMax')}
            />
            <Input
              aria-label="Currency"
              maxLength={3}
              placeholder="USD"
              className={`${quickFieldControlClass} w-16 shrink-0`}
              {...register('currency')}
            />
          </div>
        </QuickField>

        <QuickField
          icon={Gift}
          label="Pay package"
          htmlFor="compensationPackage"
          error={errors.compensationPackage?.message}
        >
          <Textarea
            id="compensationPackage"
            rows={3}
            placeholder="Bonus, benefits, allowances, paid leave — one per line"
            className={textareaClass}
            {...register('compensationPackage')}
          />
        </QuickField>

        <QuickField icon={Tag} label="Status" htmlFor="status">
          <Select id="status" className={quickFieldSelectClass} {...register('status')}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </QuickField>

        <QuickField icon={FileText} label="What the job is" htmlFor="description" error={errors.description?.message}>
          <Textarea
            id="description"
            rows={4}
            placeholder="The role in plain words: what the work is, where, for whom"
            className={textareaClass}
            {...register('description')}
          />
        </QuickField>

        <QuickField
          icon={ListChecks}
          label="What the candidate will do"
          htmlFor="responsibilities"
          error={errors.responsibilities?.message}
        >
          <Textarea
            id="responsibilities"
            rows={4}
            placeholder="Duties and day-to-day tasks — one per line"
            className={textareaClass}
            {...register('responsibilities')}
          />
        </QuickField>

        <QuickField
          icon={ClipboardCheck}
          label="What is required"
          htmlFor="requirements"
          error={errors.requirements?.message}
        >
          <Textarea
            id="requirements"
            rows={4}
            placeholder="Skills, qualifications, licences, languages — one per line"
            className={textareaClass}
            {...register('requirements')}
          />
        </QuickField>

        <QuickField
          icon={GraduationCap}
          label="Years of experience"
          error={errors.experienceYearsMin?.message ?? errors.experienceYearsMax?.message}
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label="Experience min (years)"
              type="number"
              min={0}
              max={60}
              step={1}
              placeholder="Min"
              className={quickFieldControlClass}
              {...register('experienceYearsMin')}
            />
            <span className="text-foreground/30">–</span>
            <Input
              aria-label="Experience max (years)"
              type="number"
              min={0}
              max={60}
              step={1}
              placeholder="Max (optional)"
              className={quickFieldControlClass}
              {...register('experienceYearsMax')}
            />
          </div>
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
