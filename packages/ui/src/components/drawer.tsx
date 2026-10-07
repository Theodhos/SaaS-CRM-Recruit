import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Right-side sliding panel for "quick add" style flows — same native
 * <dialog> approach as Dialog (see its comment), just anchored to the
 * right edge and full height instead of centered.
 */
export function Drawer({ open, onOpenChange, title, description, children, className }: DrawerProps) {
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
        'm-0 ml-auto flex h-dvh max-h-dvh w-full max-w-md flex-col rounded-none border-l border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50',
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold leading-none tracking-tight">{title}</h2>
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
      <div className="flex-1 overflow-y-auto px-5 pt-4">{children}</div>
    </dialog>
  );
}
