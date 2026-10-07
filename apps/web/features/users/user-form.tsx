'use client';

import { Button, Input, Label, Select } from '@crm/ui';
import { createUserSchema, type CreateUserInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { ASSIGNABLE_NAV_GROUPS, RESTRICTED_SECTIONS } from '@/components/navigation';
import { useRoles } from '@/hooks/use-roles';

const ALL_SECTIONS = ASSIGNABLE_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
/** What a user has when nothing was chosen for them: every page except the admin's (Revenue). */
const STANDARD_SECTIONS = ALL_SECTIONS.filter((href) => !RESTRICTED_SECTIONS.includes(href));

const STATUS_OPTIONS = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED'] as const;

export interface UserFormProps {
  defaultValues?: Partial<CreateUserInput>;
  submitLabel: string;
  onSubmit: (values: CreateUserInput) => Promise<void>;
  /** Swaps the password field's helper copy — "leave blank to auto-generate" (create) vs "leave blank to keep the current password" (edit). */
  isEdit?: boolean;
}

export function UserForm({ defaultValues, submitLabel, onSubmit, isEdit }: UserFormProps) {
  const { data: roles } = useRoles();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { ...defaultValues, allowedSections: defaultValues?.allowedSections?.length ? defaultValues.allowedSections : STANDARD_SECTIONS },
  });

  // Which pages of the CRM this user works with. Every page except Revenue ticked is saved as "no restriction" (an
  // empty list), so a page added to the CRM later is theirs too; Revenue is theirs only when it is ticked.
  const chosen = watch('allowedSections') ?? STANDARD_SECTIONS;
  const choose = (hrefs: string[], on: boolean) =>
    setValue('allowedSections', on ? [...new Set([...chosen, ...hrefs])] : chosen.filter((href) => !hrefs.includes(href)), { shouldDirty: true });
  const submit = (values: CreateUserInput) => {
    const picked = ALL_SECTIONS.filter((href) => (values.allowedSections ?? []).includes(href));
    const standardOnly = picked.length === STANDARD_SECTIONS.length && picked.every((href) => STANDARD_SECTIONS.includes(href));
    return onSubmit({ ...values, allowedSections: standardOnly ? [] : picked });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" {...register('firstName')} />
          {errors.firstName ? (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" {...register('lastName')} />
          {errors.lastName ? (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : (
          <p className="text-xs text-foreground/50">
            {isEdit
              ? 'Leave blank to keep their current password.'
              : 'Leave blank to auto-generate one instead (shown once after creating).'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roleId">Role</Label>
          <Select id="roleId" {...register('roleId')}>
            <option value="">Select a role…</option>
            {roles?.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
          {errors.roleId ? <p className="text-xs text-destructive">{errors.roleId.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register('status')}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm" data-testid="user-login-otp">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" {...register('loginOtpEnabled')} />
        <span>
          <span className="font-medium">Ask for an e-mail code at sign-in</span>
          <span className="block text-xs text-foreground/50">
            After the password, a 6-digit code is sent to this user&apos;s e-mail address and has to be entered to get in.
          </span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="user-sections">
        <legend className="px-1 text-sm font-medium">CRM categories this user works with</legend>
        <p className="text-xs text-foreground/50">
          Tick a category for all of its pages, or single pages. The user sees only what is ticked; admins always see everything. Revenue (Fees,
          Retainers) shows the whole organisation’s money, so it is off until you tick it.
        </p>
        {chosen.length === 0 ? <p className="text-xs text-destructive">Tick at least one page.</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ASSIGNABLE_NAV_GROUPS.map((group) => {
            const hrefs = group.items.map((item) => item.href);
            const all = hrefs.every((href) => chosen.includes(href));
            return (
              <div key={group.label} className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={all} onChange={(e) => choose(hrefs, e.target.checked)} />
                  {group.label}
                </label>
                {group.items.map((item) => (
                  <label key={item.href} className="ml-6 flex items-center gap-2 text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      value={item.href}
                      checked={chosen.includes(item.href)}
                      onChange={(e) => choose([item.href], e.target.checked)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting || chosen.length === 0}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
