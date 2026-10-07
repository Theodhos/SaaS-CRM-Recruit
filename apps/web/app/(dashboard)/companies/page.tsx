'use client';

import { Button, Drawer, Input } from '@crm/ui';
import type { CreateCompanyInput } from '@crm/validation';
import { Building2, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { companyColumns, CompanyForm } from '@/features/companies';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useCompanies, useCreateCompany, useDeleteCompany, useUpdateCompany } from '@/hooks/use-companies';
import { toFormDefaults } from '@/lib/form-defaults';
import type { CompanyWithCounts } from '@/services/companies.service';

export default function CompaniesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dialogState, setDialogState] = useState<{
    mode: 'create' | 'edit';
    company?: CompanyWithCounts;
  } | null>(null);

  const { data, isLoading } = useCompanies({ page, pageSize: 25, search: search || undefined, ownerId: ownerId || undefined });
  const addedBy = useAddedBy();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  async function handleSubmit(values: CreateCompanyInput) {
    if (dialogState?.mode === 'edit' && dialogState.company) {
      await updateCompany.mutateAsync({ id: dialogState.company.id, input: values });
    } else {
      await createCompany.mutateAsync(values);
    }
    setDialogState(null);
  }

  function handleDelete(company: CompanyWithCounts) {
    if (window.confirm(`Delete ${company.name}? Its jobs and their cards on the pipeline are deleted with it. This can't be undone.`)) {
      deleteCompany.mutate(company.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Companies</h2>
          <p className="mt-1 text-sm text-foreground/60">Manage the client companies you recruit for.</p>
        </div>
        <Button type="button" onClick={() => setDialogState({ mode: 'create' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search companies…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            setPage(1);
          }}
        />
      </div>

      {data && data.totalItems === 0 && !search && !ownerId ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Building2 className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No companies yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Add your first client company to start posting jobs against it.
          </p>
        </div>
      ) : (
        <DataTable
          columns={companyColumns({
            addedBy,
            onEdit: (company) => setDialogState({ mode: 'edit', company }),
            onDelete: handleDelete,
          })}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={(company) => router.push(`/companies/${company.id}`)}
        />
      )}

      {dialogState ? (
        <Drawer
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          title={dialogState.mode === 'edit' ? 'Edit Company' : 'Quick Add Company'}
        >
          <CompanyForm
            defaultValues={dialogState.company ? toFormDefaults(dialogState.company) : undefined}
            submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create company'}
            onSubmit={handleSubmit}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
