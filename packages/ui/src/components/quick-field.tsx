import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Borderless, underline-row input/select styling for QuickField — the box
 * chrome lives on the row (see QuickField's border-b), not the control.
 */
export const quickFieldControlClass =
  'h-8 w-full rounded-none border-0 bg-transparent px-0 text-sm shadow-none placeholder:italic placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-0';

/** Same borderless look, but keeps right padding clear of Select's chevron icon. */
export const quickFieldSelectClass =
  'h-8 w-full rounded-none border-0 bg-transparent pl-0 pr-7 text-sm shadow-none focus-visible:outline-none focus-visible:ring-0';

export interface QuickFieldProps {
  icon?: LucideIcon;
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Icon + uppercase label row used by the "quick add" drawers (candidates/companies/contacts/jobs). */
export function QuickField({
  icon: Icon,
  label,
  htmlFor,
  required,
  error,
  action,
  className,
  children,
}: QuickFieldProps) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-border py-3 last:border-b-0', className)}>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground/60"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/40" /> : null}
          <span>
            {label}
            {required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </span>
        </label>
        <div className="mt-1">{children}</div>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
      {action ? <div className="shrink-0 pt-4">{action}</div> : null}
    </div>
  );
}
