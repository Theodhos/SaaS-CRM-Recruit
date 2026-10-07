'use client';

import { Button, Input, Label, Textarea } from '@crm/ui';
import { createTeamSchema, type CreateTeamInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

export interface TeamFormProps {
  defaultValues?: Partial<CreateTeamInput>;
  submitLabel: string;
  onSubmit: (values: CreateTeamInput) => Promise<void>;
}

export function TeamForm({ defaultValues, submitLabel, onSubmit }: TeamFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues,
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Team name</Label>
        <Input id="name" {...register('name')} />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register('description')} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
