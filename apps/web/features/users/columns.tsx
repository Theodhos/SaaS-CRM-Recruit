import type { User } from '@crm/types';
import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Pencil, Trash2, UserX } from 'lucide-react';

import { USER_STATUS_COLOUR, roleColour } from '@/lib/status-colors';
import type { UserWorkload } from '@/services/users.service';

const STATUS_VARIANT = USER_STATUS_COLOUR;


const count = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());

export function userColumns(options: {
  workload: Map<string, UserWorkload>;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  /** Left out for the rows that cannot be deleted (oneself, the organisation's owner). */
  onDelete?: (user: User) => void;
  canDelete?: (user: User) => boolean;
  onResetPassword: (user: User) => void;
}): ColumnDef<User, unknown>[] {
  const w = (user: User) => options.workload.get(user.id);
  return [
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="text-xs text-foreground/50">{row.original.email}</p>
        </div>
      ),
    },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: ({ row }) => (
        <Badge variant={roleColour(row.original.role.name)}>{row.original.role.name}</Badge>
      ),
    },
    // What each instructor has built in their own account — the same records they see when they sign in.
    { header: 'Companies', id: 'companies', cell: ({ row }) => count(w(row.original)?.companies) },
    { header: 'Jobs', id: 'jobs', cell: ({ row }) => count(w(row.original)?.jobs) },
    { header: 'Candidates', id: 'candidates', cell: ({ row }) => count(w(row.original)?.candidates) },
    { header: 'Active employees', id: 'activeEmployees', cell: ({ row }) => count(w(row.original)?.activeEmployees) },
    {
      header: 'Password',
      id: 'password',
      cell: ({ row }) =>
        row.original.status === 'DEACTIVATED' ? (
          <span className="text-xs text-foreground/40">—</span>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => options.onResetPassword(row.original)}>
            <KeyRound className="mr-1 h-3.5 w-3.5" /> Set new &amp; show
          </Button>
        ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => options.onEdit(row.original)} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          {row.original.status !== 'DEACTIVATED' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => options.onDeactivate(row.original)}
              aria-label="Deactivate"
            >
              <UserX className="h-4 w-4" />
            </Button>
          ) : null}
          {options.onDelete && (options.canDelete?.(row.original) ?? true) ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => options.onDelete?.(row.original)} aria-label="Delete user" title="Delete for good">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
}
