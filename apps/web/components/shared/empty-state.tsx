import { Button } from '@crm/ui';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
}

/**
 * Shared placeholder for every not-yet-implemented dashboard page. Real
 * pages replace this with an actual list/table + form in Phase 2 — this
 * exists so the app looks and feels finished while there is nothing real
 * to show yet, instead of a bare heading.
 */
export function EmptyState({ icon: Icon, title, description, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-foreground/60">{description}</p>
        </div>
        {actionLabel ? <Button disabled>{actionLabel}</Button> : null}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <Icon className="h-6 w-6 text-foreground/50" />
        </div>
        <h3 className="mt-4 text-sm font-semibold">No {title.toLowerCase()} yet</h3>
        <p className="mt-1 max-w-sm text-sm text-foreground/50">
          This view will list real data from the database once the {title.toLowerCase()} module is
          implemented.
        </p>
      </div>
    </div>
  );
}
