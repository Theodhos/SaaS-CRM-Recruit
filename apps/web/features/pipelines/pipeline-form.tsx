'use client';

import { Button, Input, Label, Select, Textarea } from '@crm/ui';
import { createPipelineSchema, type CreatePipelineInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

const STAGE_TYPE_OPTIONS = ['STANDARD', 'PLACED', 'REJECTED'] as const;

/** The agency's default scheme — every new pipeline starts from it; each stage has its own form (stage-forms.ts). */
export const DEFAULT_STAGES: CreatePipelineInput['stages'] = [
  { name: 'New', order: 1, type: 'STANDARD' },
  { name: 'Screening', order: 2, type: 'STANDARD' },
  { name: 'Interview', order: 3, type: 'STANDARD' },
  { name: 'Offer', order: 4, type: 'STANDARD' },
  { name: 'Active Employees', order: 5, type: 'PLACED' },
  { name: 'Rejected', order: 6, type: 'REJECTED' },
  // where Active Employees' Completed button sends a finished contract (see completed-stage.ts)
  { name: 'Completed', order: 7, type: 'STANDARD' },
];

export interface PipelineFormProps {
  defaultValues?: Partial<CreatePipelineInput>;
  submitLabel: string;
  onSubmit: (values: CreatePipelineInput) => Promise<void>;
}

/** New-pipeline form: pre-fills a sensible standard funnel so most users just rename/tweak it, but every stage — including which one is the "Placed" auto-Placement trigger — is editable before creating. */
export function PipelineForm({ defaultValues, submitLabel, onSubmit }: PipelineFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePipelineInput>({
    resolver: zodResolver(createPipelineSchema),
    defaultValues: { stages: DEFAULT_STAGES, employmentType: 'PERMANENT', ...defaultValues },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'stages' });

  // Position in the list IS the order — reassigned here rather than left as
  // an editable field, so adding/removing a row never leaves a gap or a
  // stale number the user has to fix by hand.
  function submitWithSequentialOrder(values: CreatePipelineInput) {
    return onSubmit({ ...values, stages: values.stages.map((s, i) => ({ ...s, order: i + 1 })) });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submitWithSequentialOrder)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Pipeline name</Label>
        <Input id="name" {...register('name')} placeholder="e.g. Executive Search Pipeline" />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employmentType">Placed candidates become</Label>
        <Select id="employmentType" {...register('employmentType')}>
          <option value="PERMANENT">Permanent employees</option>
          <option value="TEMPORARY">Temporary employees</option>
        </Select>
        <p className="text-xs text-foreground/50">Decided by the scheme: whoever reaches “Placed” here lands on Active Employees with this type.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Stages</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: '', order: fields.length + 1, type: 'STANDARD' })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add stage
          </Button>
        </div>
        <p className="text-xs text-foreground/50">
          The stage marked &quot;Placed&quot; automatically creates a Placement (candidate + job +
          company) once an application reaches it.
        </p>

        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs text-foreground/40">{index + 1}</span>
              <Input
                {...register(`stages.${index}.name` as const)}
                placeholder="Stage name"
                className="flex-1"
              />
              <Select {...register(`stages.${index}.type` as const)} className="w-36 shrink-0">
                {STAGE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={fields.length <= 1}
                onClick={() => remove(index)}
                aria-label="Remove stage"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {errors.stages?.message ? <p className="text-xs text-destructive">{errors.stages.message}</p> : null}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
