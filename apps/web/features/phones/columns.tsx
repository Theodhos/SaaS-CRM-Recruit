'use client';

import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Phone as PhoneIcon } from 'lucide-react';

import type { Phone } from '@/services/phones.service';

import { CALL_STATUS_LABEL, CALL_STATUS_VARIANT } from './call-status';

export function phoneColumns(options: { onCall: (phone: Phone) => void; callingEnabled: boolean }): ColumnDef<Phone, unknown>[] {
  return [
    { header: 'Name', accessorKey: 'name', cell: ({ row }) => <span className="font-medium">{row.original.name ?? '—'}</span> },
    {
      header: 'Phone',
      accessorKey: 'normalizedPhone',
      cell: ({ row }) => (
        <span className="tabular-nums" title={`As imported: ${row.original.phone}`}>
          {row.original.normalizedPhone}
        </span>
      ),
    },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '—' },
    { header: 'Company', accessorKey: 'company', cell: ({ row }) => row.original.company ?? '—' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) =>
        row.original.status === 'DO_NOT_CALL' ? (
          <Badge variant="destructive">Do not call</Badge>
        ) : row.original.lastCallStatus ? (
          <Badge variant={CALL_STATUS_VARIANT[row.original.lastCallStatus]}>{CALL_STATUS_LABEL[row.original.lastCallStatus]}</Badge>
        ) : (
          <Badge variant="default">Ready</Badge>
        ),
    },
    {
      header: 'Last call',
      accessorKey: 'lastCallAt',
      cell: ({ row }) => (row.original.lastCallAt ? new Date(row.original.lastCallAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'),
    },
    { header: 'Calls', accessorKey: 'callCount', cell: ({ row }) => <span className="tabular-nums">{row.original.callCount}</span> },
    { header: 'Created', accessorKey: 'createdAt', cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => options.onCall(row.original)}
            disabled={row.original.status === 'DO_NOT_CALL'}
            title={options.callingEnabled ? 'Call from the browser' : 'Browser calling is not connected yet'}
          >
            <PhoneIcon className="mr-1 h-3.5 w-3.5" /> Call
          </Button>
        </div>
      ),
    },
  ];
}
