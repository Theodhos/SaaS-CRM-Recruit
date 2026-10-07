'use client';

import { Button } from '@crm/ui';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
  /** Makes the whole row a click target (clicks on links, buttons and form controls inside the row keep their own behaviour). */
  onRowClick?: (row: TData) => void;
}

/**
 * Server-paginated table shared by every entity list page (Candidates,
 * Companies, Jobs). Sorting/filtering happen server-side via each
 * page's search/status query params — this component only renders the
 * current page and drives page navigation, it never re-derives pagination
 * from client-held data (see spec §39: all lists must be server-paginated).
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  emptyMessage = 'No records found.',
  onRowClick,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-accent/40 text-left text-xs font-medium uppercase tracking-wide text-foreground/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-4 py-2.5">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-foreground/50">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-foreground/50">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border last:border-0 hover:bg-accent/30${onRowClick ? ' cursor-pointer' : ''}`}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-foreground/60">
        <span>
          {totalItems === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${totalItems}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
