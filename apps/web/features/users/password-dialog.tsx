'use client';

import { Badge, Button, Dialog } from '@crm/ui';
import { Copy } from 'lucide-react';

/**
 * Shows a password exactly once (right after it was created or reset). Passwords are stored as one-way hashes, so
 * this is the only moment it can be displayed — the admin copies it and hands it to the instructor.
 */
export function PasswordDialog({
  title,
  email,
  password,
  note,
  onClose,
}: {
  title: string;
  email: string;
  password: string;
  note?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={() => onClose()} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70">
          Password for <strong>{email}</strong>. It is shown only once — copy it now and share it with them.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border bg-accent/40 px-3 py-2">
          <code className="flex-1 text-sm">{password}</code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(password)}
            aria-label="Copy password"
            className="text-foreground/50 hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        {note ? (
          <Badge variant="outline" className="w-fit">
            {note}
          </Badge>
        ) : null}
        <div className="mt-2 flex justify-end">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
