import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import type { AddedBy } from '@/hooks/use-added-by';
import { COMPANY_STATUS_COLOUR } from '@/lib/status-colors';
import type { CompanyWithCounts } from '@/services/companies.service';

const STATUS_VARIANT = COMPANY_STATUS_COLOUR;

export function companyColumns(options: {
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  addedBy?: AddedBy;
  onEdit: (company: CompanyWithCounts) => void;
  onDelete: (company: CompanyWithCounts) => void;
}): ColumnDef<CompanyWithCounts, unknown>[] {
  return [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <Link href={`/companies/${row.original.id}`} className="font-medium hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { header: 'Industry', accessorKey: 'industry', cell: ({ row }) => row.original.industry ?? '—' },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '—' },
    { header: 'City', accessorKey: 'city', cell: ({ row }) => row.original.city ?? '—' },
    {
      header: 'Team',
      id: 'team',
      cell: ({ row }) => (
        <span className="text-foreground/70">
          {row.original._count.jobs} job{row.original._count.jobs === 1 ? '' : 's'} ·{' '}
          {row.original._count.candidates} employee{row.original._count.candidates === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {row.original.status.replaceAll('_', ' ')}
        </Badge>
      ),
    },
    ...(options.addedBy
      ? [
          {
            id: 'addedBy',
            header: 'Added by',
            cell: ({ row }: { row: { original: { ownerId: string | null } } }) => options.addedBy!(row.original.ownerId),
          },
        ]
      : []),
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => options.onEdit(row.original)}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => options.onDelete(row.original)}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
