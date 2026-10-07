import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import type { AddedBy } from '@/hooks/use-added-by';
import { JOB_STATUS_COLOUR, employmentTypeColour } from '@/lib/status-colors';
import type { JobWithCompany } from '@/services/jobs.service';

import { experienceLabel } from './experience';

const STATUS_VARIANT = JOB_STATUS_COLOUR;

export function jobColumns(options: {
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  addedBy?: AddedBy;
  onEdit: (job: JobWithCompany) => void;
  onDelete: (job: JobWithCompany) => void;
}): ColumnDef<JobWithCompany, unknown>[] {
  return [
    {
      header: 'Title',
      accessorKey: 'title',
      cell: ({ row }) => (
        <Link href={`/jobs/${row.original.id}`} className="font-medium hover:underline">
          {row.original.title}
        </Link>
      ),
    },
    {
      header: 'Company',
      accessorKey: 'company',
      cell: ({ row }) =>
        row.original.company ? (
          <Link href={`/companies/${row.original.company.id}`} className="hover:underline">
            {row.original.company.name}
          </Link>
        ) : (
          <span className="text-foreground/40">No company linked</span>
        ),
    },
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => row.original.location ?? '—' },
    {
      header: 'Type',
      accessorKey: 'employmentType',
      cell: ({ row }) => (
        <Badge variant={employmentTypeColour(row.original.employmentType)}>{row.original.employmentType.replaceAll('_', ' ')}</Badge>
      ),
    },
    {
      header: 'Experience',
      id: 'experience',
      cell: ({ row }) =>
        experienceLabel(row.original.experienceYearsMin, row.original.experienceYearsMax) ?? (
          <span className="text-foreground/40">Not set</span>
        ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status.replaceAll('_', ' ')}</Badge>
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
