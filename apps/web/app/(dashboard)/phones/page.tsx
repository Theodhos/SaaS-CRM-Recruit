'use client';

import { Button, Input, Label, Select } from '@crm/ui';
import { Phone as PhoneIcon, Search, Upload } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { CallDialog, PhoneHistoryDrawer, PhoneImportDialog, phoneColumns } from '@/features/phones';
import { usePhoneCapabilities, usePhones } from '@/hooks/use-phones';
import type { CallFilter, Phone } from '@/services/phones.service';

const FILTERS: { value: CallFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'NEVER_CALLED', label: 'Never called' },
  { value: 'CALLED', label: 'Called' },
  { value: 'ANSWERED', label: 'Answered' },
  { value: 'NO_ANSWER', label: 'No answer' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'FAILED', label: 'Failed' },
];

/**
 * Communication → Phones: numbers imported from Excel, searched and filtered on the server, called from the
 * browser, with the call history kept per number. See docs/api/phones.md.
 */
export default function PhonesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [callFilter, setCallFilter] = useState<CallFilter>('ALL');
  const [importOpen, setImportOpen] = useState(false);
  const [calling, setCalling] = useState<Phone | null>(null);
  const [viewing, setViewing] = useState<Phone | null>(null);

  const { data, isLoading, refetch } = usePhones({ page, pageSize: 25, search: search || undefined, callFilter });
  const { data: caps } = usePhoneCapabilities();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Phones</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Numbers imported from your Excel lists — normalised, de-duplicated and callable straight from the browser. Click a row for its call
            history.
            {caps && !caps.calling ? ' Browser calling is not connected yet: add the Twilio settings to the API to enable the Call button.' : ''}
          </p>
        </div>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1.5 h-4 w-4" /> Import Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search phone, name, email, company…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="call-filter">Calls</Label>
          <Select
            id="call-filter"
            className="w-40"
            value={callFilter}
            onChange={(event) => {
              setCallFilter(event.target.value as CallFilter);
              setPage(1);
            }}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {data && data.totalItems === 0 && !search && callFilter === 'ALL' ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <PhoneIcon className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No phones yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">Import an Excel file (a Phone column plus optional Name, Email, Company).</p>
          <Button type="button" className="mt-4" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Import Excel
          </Button>
        </div>
      ) : (
        <DataTable
          columns={phoneColumns({ onCall: setCalling, callingEnabled: caps?.calling ?? false })}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={setViewing}
          emptyMessage="No phones match."
        />
      )}

      {importOpen ? (
        <PhoneImportDialog
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            void refetch();
          }}
        />
      ) : null}
      {viewing ? (
        <PhoneHistoryDrawer
          phone={viewing}
          onClose={() => setViewing(null)}
          onCall={(phone) => {
            setViewing(null);
            setCalling(phone);
          }}
        />
      ) : null}
      {calling ? <CallDialog phone={calling} onClose={() => setCalling(null)} /> : null}
    </div>
  );
}
