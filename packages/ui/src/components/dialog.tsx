import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Usually plain text; a node when the heading has parts of its own (name, company, job…). */
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Pinned to the bottom of the dialog's own scroll area (e.g. a Save button) — stays in view while `children` scrolls underneath it. */
  footer?: React.ReactNode;
}

/**
 * Built on the native <dialog> element — it already provides focus
 * trapping, ESC-to-close, and a backdrop, so there's no need for a
 * Radix/headless-ui dependency for the one modal shape this app uses
 * (a form in a centered panel). See packages/ui's shadcn-pattern note.
 */
export function Dialog({ open, onOpenChange, title, description, children, className, footer }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        'w-full max-w-lg rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div>
          <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
          {description ? <p className="mt-1.5 text-sm text-foreground/60">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-md p-1 text-foreground/50 hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-6">{children}</div>
      {footer ? <div className="sticky bottom-0 border-t border-border bg-background p-4">{footer}</div> : null}
    </dialog>
  );
}
