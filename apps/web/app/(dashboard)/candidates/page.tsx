'use client';

import { Button, Drawer, Input, Label, Select } from '@crm/ui';
import type { CreateCandidateInput } from '@crm/validation';
import { Plus, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { CandidateForm, unassignedCandidateColumns } from '@/features/candidates';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useCreateApplication } from '@/hooks/use-applications';
import { useCandidates, useCreateCandidate } from '@/hooks/use-candidates';
import { useUploadDocument } from '@/hooks/use-documents';
import type { CandidateWithCompany, ReviewStatus, SuggestedJob } from '@/services/candidates.service';

/**
 * The Candidates directory: everyone who applied — through the website form or added by hand. Every new arrival is
 * put straight onto the pipeline of the job they want by the API (CandidateIntakeService), which also notifies the
 * team, so their status here is simply read off that pipeline: Pending (not on a pipeline), Active (on a pipeline,
 * with the stage) or Rejected. Ranked highest-potential-first.
 */
export default function CandidatesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | ''>('');
  const [ownerId, setOwnerId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useCandidates({
    reviewStatus: reviewStatus || undefined,
    page,
    pageSize: 25,
    search: search || undefined,
    ownerId: ownerId || undefined,
  });
  const addedBy = useAddedBy();
  const createCandidate = useCreateCandidate();
  const uploadDocument = useUploadDocument();
  const createApplication = useCreateApplication();
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  // Manual entry (typed in, or pre-filled by scanning a CV in the form). The API puts them on the pipeline of the
  // job chosen in the form and raises the "new candidate" notification.
  async function handleCreateCandidate(values: CreateCandidateInput, resume?: File) {
    const candidate = await createCandidate.mutateAsync(values);
    // the scanned file stays with the person as their CV (previewed on their page); the candidate exists either way
    if (resume) {
      await uploadDocument
        .mutateAsync({ file: resume, type: 'CV', candidateId: candidate.id })
        .catch(() => window.alert('The candidate was created, but the CV could not be saved — upload it from their page.'));
    }
    setCreateOpen(false);
  }

  // "Suggested for open jobs": one click puts a previously rejected person on the similar opening's pipeline.
  async function handleApplySuggestion(candidate: CandidateWithCompany, job: SuggestedJob) {
    setApplyingKey(`${candidate.id}:${job.id}`);
    try {
      await createApplication.mutateAsync({ candidateId: candidate.id, jobId: job.id });
    } finally {
      setApplyingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Candidates</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Everyone who applied — from your website or added by hand. New arrivals go straight onto the pipeline,
            so the status here follows their pipeline stage: Active (with the stage), Rejected, or Pending when not
            on a pipeline yet. Click a candidate to see all of their details.
          </p>
        </div>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Candidate
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search name, phone, job, company, email…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-status">Status</Label>
          <Select
            id="review-status"
            className="w-40"
            value={reviewStatus}
            onChange={(event) => {
              setReviewStatus(event.target.value as ReviewStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
            <option value="REAPPLIED">Re-applied (rejected before, live again)</option>
            <option value="SUGGESTED">Suggested for open jobs (rejected, similar job open now)</option>
          </Select>
        </div>
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            setPage(1);
          }}
        />
        {reviewStatus === 'SUGGESTED' ? (
          <p className="max-w-xl text-xs text-foreground/50">
            People turned down for a job for which a <b>similar position is open now</b> and they have not applied to yet. “Put on pipeline” sends them
            straight to that job’s pipeline.
          </p>
        ) : null}
      </div>

      {data && data.totalItems === 0 && !search && !reviewStatus ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Users className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No candidates yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Applications from your website arrive here automatically, and so does everyone you add — each one goes
            straight onto the pipeline of the job they want.
          </p>
        </div>
      ) : (
        <DataTable
          columns={unassignedCandidateColumns({
            addedBy,
            ...(reviewStatus === 'SUGGESTED' ? { suggestions: { onApply: handleApplySuggestion, pendingKey: applyingKey } } : {}),
          })}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={(candidate) => router.push(`/candidates/${candidate.id}`)}
        />
      )}

      {createOpen ? (
        <Drawer open onOpenChange={(open) => !open && setCreateOpen(false)} title="Add Candidate">
          <CandidateForm
            submitLabel="Create candidate"
            requireInterestedJob
            onSubmit={handleCreateCandidate}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
