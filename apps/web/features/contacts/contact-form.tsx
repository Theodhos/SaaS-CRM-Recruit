'use client';

import {
  Button,
  Input,
  QuickField,
  Select,
  quickFieldControlClass,
  quickFieldSelectClass,
  SearchSelect,
} from '@crm/ui';
import { createContactSchema, type CreateContactInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Building2, Mail, Phone, Tag, User } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useCompanies } from '@/hooks/use-companies';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const;

export interface ContactFormProps {
  /** The company the contact belongs to, when the form is opened from that company's page: shown read-only, not picked. */
  company?: { id: string; name: string };
  defaultValues?: Partial<CreateContactInput>;
  onSubmit: (values: CreateContactInput) => Promise<void>;
  submitLabel: string;
}

export function ContactForm({ company, defaultValues, onSubmit, submitLabel }: ContactFormProps) {
  const { data: companies } = useCompanies({ pageSize: 100 }, { enabled: !company });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateContactInput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: company ? { ...defaultValues, companyId: company.id } : defaultValues,
  });

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col">
        <QuickField icon={Building2} label="Company" htmlFor="companyId" required error={errors.companyId?.message}>
          {company ? (
            <>
              <input type="hidden" id="companyId" {...register('companyId')} />
              <Input value={company.name} readOnly disabled className={quickFieldControlClass} aria-label="Company" />
            </>
          ) : (
            <SearchSelect id="companyId" className={quickFieldSelectClass} {...register('companyId')}>
              <option value="">Select a company…</option>
              {companies?.items.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </SearchSelect>
          )}
        </QuickField>

        <QuickField icon={User} label="First name" htmlFor="firstName" required error={errors.firstName?.message}>
          <Input id="firstName" className={quickFieldControlClass} {...register('firstName')} />
        </QuickField>

        <QuickField icon={User} label="Last name" htmlFor="lastName" required error={errors.lastName?.message}>
          <Input id="lastName" className={quickFieldControlClass} {...register('lastName')} />
        </QuickField>

        <QuickField icon={Briefcase} label="Job title" htmlFor="jobTitle">
          <Input id="jobTitle" className={quickFieldControlClass} {...register('jobTitle')} />
        </QuickField>

        <QuickField icon={Mail} label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" className={quickFieldControlClass} {...register('email')} />
        </QuickField>

        <QuickField icon={Phone} label="Phone" htmlFor="phone">
          <Input id="phone" className={quickFieldControlClass} {...register('phone')} />
        </QuickField>

        <QuickField icon={Tag} label="Status" htmlFor="status">
          <Select id="status" className={quickFieldSelectClass} {...register('status')}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
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
