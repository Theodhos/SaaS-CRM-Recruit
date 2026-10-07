'use client';

import { Button, Drawer, Input } from '@crm/ui';
import type { CreateJobInput } from '@crm/validation';
import { Briefcase, Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { JobForm, jobColumns } from '@/features/jobs';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useCreateJob, useDeleteJob, useJobs, useUpdateJob } from '@/hooks/use-jobs';
import { toFormDefaults } from '@/lib/form-defaults';
import type { JobWithCompany } from '@/services/jobs.service';

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; job?: JobWithCompany } | null>(
    null,
  );

  const { data, isLoading } = useJobs({ page, pageSize: 25, search: search || undefined, ownerId: ownerId || undefined });
  const addedBy = useAddedBy();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();

  async function handleSubmit(values: CreateJobInput) {
    if (dialogState?.mode === 'edit' && dialogState.job) {
      await updateJob.mutateAsync({ id: dialogState.job.id, input: values });
    } else {
      await createJob.mutateAsync(values);
    }
    setDialogState(null);
  }

  function handleDelete(job: JobWithCompany) {
    if (window.confirm(`Close and delete ${job.title}? The cards of the people who applied to it leave the pipeline too.`)) {
      deleteJob.mutate(job.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Jobs</h2>
          <p className="mt-1 text-sm text-foreground/60">Post and manage open recruitment vacancies.</p>
        </div>
        <Button type="button" onClick={() => setDialogState({ mode: 'create' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Job
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search jobs…"
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
            <Briefcase className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No jobs yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Post your first job — pick an existing company, type a new one, or leave it unlinked
            for now.
          </p>
        </div>
      ) : (
        <DataTable
          columns={jobColumns({
            addedBy,
            onEdit: (job) => setDialogState({ mode: 'edit', job }),
            onDelete: handleDelete,
          })}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}

      {dialogState ? (
        <Drawer
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          title={dialogState.mode === 'edit' ? 'Edit Job' : 'Quick Add Job'}
        >
          <JobForm
            defaultValues={
              dialogState.job
                ? {
                    ...toFormDefaults(dialogState.job),
                    salaryMin: dialogState.job.salaryMin ? Number(dialogState.job.salaryMin) : undefined,
                    salaryMax: dialogState.job.salaryMax ? Number(dialogState.job.salaryMax) : undefined,
                  }
                : undefined
            }
            submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create job'}
            onSubmit={handleSubmit}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
