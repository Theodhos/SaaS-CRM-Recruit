'use client';

import {
  Button,
  Input,
  QuickField,
  Select,
  quickFieldControlClass,
  quickFieldSelectClass,
} from '@crm/ui';
import { createCompanySchema, type CreateCompanyInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Globe, Mail, MapPin, Phone, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';

const STATUS_OPTIONS = ['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const;

export interface CompanyFormProps {
  defaultValues?: Partial<CreateCompanyInput>;
  onSubmit: (values: CreateCompanyInput) => Promise<void>;
  submitLabel: string;
}

export function CompanyForm({ defaultValues, onSubmit, submitLabel }: CompanyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues,
  });

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col">
        <QuickField icon={Building2} label="Company name" htmlFor="name" required error={errors.name?.message}>
          <Input id="name" className={quickFieldControlClass} {...register('name')} />
        </QuickField>

        <QuickField icon={Tag} label="Industry" htmlFor="industry">
          <Input id="industry" className={quickFieldControlClass} {...register('industry')} />
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

        <QuickField icon={Mail} label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" className={quickFieldControlClass} {...register('email')} />
        </QuickField>

        <QuickField icon={Phone} label="Phone" htmlFor="phone">
          <Input id="phone" className={quickFieldControlClass} {...register('phone')} />
        </QuickField>

        <QuickField icon={Globe} label="Website" htmlFor="website" error={errors.website?.message}>
          <Input id="website" placeholder="https://" className={quickFieldControlClass} {...register('website')} />
        </QuickField>

        <QuickField icon={MapPin} label="City" htmlFor="city">
          <Input id="city" className={quickFieldControlClass} {...register('city')} />
        </QuickField>

        <QuickField icon={MapPin} label="Country" htmlFor="country">
          <Input id="country" className={quickFieldControlClass} {...register('country')} />
        </QuickField>

        <QuickField icon={MapPin} label="Address" htmlFor="address">
          <Input id="address" className={quickFieldControlClass} {...register('address')} />
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
