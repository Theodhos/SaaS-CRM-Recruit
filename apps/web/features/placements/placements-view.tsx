'use client';

import { Button, Dialog, Input, Label, Select } from '@crm/ui';
import type { CreatePlacementInput } from '@crm/validation';
import { Search, Trophy } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useUploadDocument } from '@/hooks/use-documents';
import { useDeletePlacement, usePlacements, useUpdatePlacement } from '@/hooks/use-placements';
import { toFormDefaults } from '@/lib/form-defaults';
import type { PlacementWithRelations } from '@/services/placements.service';

import { placementColumns } from './columns';
import { EmployeeDocumentsDialog } from './employee-documents-dialog';
import { PlacementForm } from './placement-form';

/** One half of a split view: its own fixed status/employment-type (overriding the page's own filter for that side) and copy. */
export interface SplitSide {
  label: string;
  emptyMessage: string;
  /** Overrides the `status` prop for this side only. Left out, this side follows the page's own status. */
  status?: string;
  /** Overrides the employment-type filter for this side only. Left out, this side follows the "Employment type" select. */
  employmentType?: 'PERMANENT' | 'TEMPORARY';
}

export interface SplitViewConfig {
  /** The split button's own label, e.g. "Permanent / Temporary" or "Terminated / Completed". */
  toggleLabel: string;
  /** Which column every row in the split already shares, and so says nothing extra — hidden there, shown in the plain list. */
  hideColumn: 'type' | 'status';
  left: SplitSide;
  right: SplitSide;
}

/**
 * The list of people who were hired, for one or more statuses of the employment: ACTIVE is the Active Employees
 * page, "COMPLETED,CANCELLED" (comma-separated) the Completed Contract page, showing both outcomes together by
 * default. Search, the employment-type filter, edit and remove are the same on both; `filters` adds a page's own
 * filter next to them.
 *
 * `splitView`: adds a second view — two tables side by side instead of one — next to the plain list above. Each
 * half keeps its own paging; search, "Added by" and (unless the split itself is by type) the employment-type
 * filter apply to both sides at once. Whichever filter the split already does the job of (`hideColumn`) is hidden
 * while split, same as its column is hidden in each side's table.
 */
export function PlacementsView({
  title,
  description,
  status,
  filters,
  empty,
  splitView,
}: {
  title: string;
  description: string;
  /** One status ("ACTIVE"), or several separated by commas ("COMPLETED,CANCELLED"). */
  status: string;
  filters?: ReactNode;
  empty: { title: string; text: string };
  splitView?: SplitViewConfig;
}) {
  const [viewMode, setViewMode] = useState<'list' | 'split'>('list');
  const isSplit = Boolean(splitView) && viewMode === 'split';
  const hideTypeFilter = isSplit && splitView?.hideColumn === 'type';
  const hideStatusFilter = isSplit && splitView?.hideColumn === 'status';
  const [page, setPage] = useState(1);
  const [leftPage, setLeftPage] = useState(1);
  const [rightPage, setRightPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingPlacement, setEditingPlacement] = useState<PlacementWithRelations | null>(null);
  // clicking a person opens what was uploaded for them (there is no separate Documents page)
  const [documentsOf, setDocumentsOf] = useState<PlacementWithRelations | null>(null);

  const [employmentType, setEmploymentType] = useState<'' | 'PERMANENT' | 'TEMPORARY'>('');
  const [ownerId, setOwnerId] = useState('');
  const resetPaging = () => {
    setPage(1);
    setLeftPage(1);
    setRightPage(1);
  };

  const { data, isLoading } = usePlacements(
    { page, pageSize: 25, status, search: search || undefined, employmentType: employmentType || undefined, ownerId: ownerId || undefined },
    { enabled: !isSplit },
  );
  const { data: leftData, isLoading: leftLoading } = usePlacements(
    {
      page: leftPage,
      pageSize: 25,
      status: splitView?.left.status ?? status,
      search: search || undefined,
      employmentType: splitView?.left.employmentType ?? (employmentType || undefined),
      ownerId: ownerId || undefined,
    },
    { enabled: isSplit },
  );
  const { data: rightData, isLoading: rightLoading } = usePlacements(
    {
      page: rightPage,
      pageSize: 25,
      status: splitView?.right.status ?? status,
      search: search || undefined,
      employmentType: splitView?.right.employmentType ?? (employmentType || undefined),
      ownerId: ownerId || undefined,
    },
    { enabled: isSplit },
  );
  const addedBy = useAddedBy();
  const updatePlacement = useUpdatePlacement();
  const deletePlacement = useDeletePlacement();
  const uploadDocument = useUploadDocument();

  async function handleSubmit(values: CreatePlacementInput, file: File | null) {
    if (!editingPlacement) return;
    const placement = await updatePlacement.mutateAsync({ id: editingPlacement.id, input: values });

    if (file) {
      await uploadDocument.mutateAsync({
        file,
        type: 'CONTRACT',
        placementId: placement.id,
        candidateId: values.candidateId,
        companyId: values.companyId,
      });
    }
    setEditingPlacement(null);
  }

  function handleDelete(placement: PlacementWithRelations) {
    if (
      window.confirm(
        `Remove ${placement.candidate.firstName} ${placement.candidate.lastName} as a placement? Their documents stay with the candidate.`,
      )
    ) {
      deletePlacement.mutate(placement.id);
    }
  }

  const columns = placementColumns({
    addedBy,
    onOpen: setDocumentsOf,
    onEdit: setEditingPlacement,
    onDelete: handleDelete,
    showStatus: status !== 'ACTIVE' && !hideStatusFilter,
    // hidden in every split view, not just the one split by type — kept out of both side tables either way
    showType: !isSplit,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-foreground/60">{description}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search employees…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPaging();
            }}
          />
        </div>
        {hideStatusFilter ? null : filters}
        {hideTypeFilter ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employment-type">Employment type</Label>
            <Select
              id="employment-type"
              className="w-44"
              value={employmentType}
              onChange={(event) => {
                setEmploymentType(event.target.value as '' | 'PERMANENT' | 'TEMPORARY');
                resetPaging();
              }}
            >
              <option value="">All employees</option>
              <option value="PERMANENT">Permanent</option>
              <option value="TEMPORARY">Temporary</option>
            </Select>
          </div>
        )}
        {splitView ? (
          <div className="flex flex-col gap-1.5">
            <Label>View</Label>
            <div className="flex gap-1 rounded-md border border-border p-1" role="tablist" aria-label="View">
              <Button type="button" size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
                List
              </Button>
              <Button type="button" size="sm" variant={viewMode === 'split' ? 'default' : 'ghost'} aria-pressed={viewMode === 'split'} onClick={() => setViewMode('split')}>
                {splitView.toggleLabel}
              </Button>
            </div>
          </div>
        ) : null}
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            resetPaging();
          }}
        />
      </div>

      {isSplit && splitView ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground/70">{splitView.left.label}</h3>
            <DataTable
              columns={columns}
              onRowClick={setDocumentsOf}
              data={leftData?.items ?? []}
              isLoading={leftLoading}
              page={leftData?.page ?? leftPage}
              pageSize={leftData?.pageSize ?? 25}
              totalItems={leftData?.totalItems ?? 0}
              totalPages={leftData?.totalPages ?? 1}
              onPageChange={setLeftPage}
              emptyMessage={splitView.left.emptyMessage}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground/70">{splitView.right.label}</h3>
            <DataTable
              columns={columns}
              onRowClick={setDocumentsOf}
              data={rightData?.items ?? []}
              isLoading={rightLoading}
              page={rightData?.page ?? rightPage}
              pageSize={rightData?.pageSize ?? 25}
              totalItems={rightData?.totalItems ?? 0}
              totalPages={rightData?.totalPages ?? 1}
              onPageChange={setRightPage}
              emptyMessage={splitView.right.emptyMessage}
            />
          </div>
        </div>
      ) : data && data.totalItems === 0 && !search && !employmentType && !ownerId ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Trophy className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">{empty.title}</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">{empty.text}</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          onRowClick={setDocumentsOf}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}

      {documentsOf ? <EmployeeDocumentsDialog placement={documentsOf} onClose={() => setDocumentsOf(null)} /> : null}

      {editingPlacement ? (
        <Dialog open onOpenChange={(open) => !open && setEditingPlacement(null)} title="Edit placement">
          <PlacementForm
            defaultValues={{
              ...toFormDefaults(editingPlacement),
              startDate: editingPlacement.startDate.slice(0, 10),
              endDate: editingPlacement.endDate?.slice(0, 10),
            }}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
