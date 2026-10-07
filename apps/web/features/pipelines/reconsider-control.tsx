'use client';

import { Button, Dialog, SearchSelect } from '@crm/ui';
import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useCreateApplication } from '@/hooks/use-applications';
import { useCompanies } from '@/hooks/use-companies';
import { useJobs } from '@/hooks/use-jobs';
import type { ApplicationWithRelations } from '@/services/applications.service';
import { upsertStageNote } from '@/services/stage-notes.service';

import { TONES } from './stage-colors';
import { pushUndo } from './undo';

/**
 * Rejected -> back in the running. The pop-up is entirely optional to fill in: it opens pre-set to the job they
 * were rejected for, so confirming right away just reopens that same card at the first stage (New); picking
 * another company/job instead creates a new card for it (ApplicationsService.create does both). Either way, New
 * marks the card "Reconsidered" (see card-badges.tsx) so it reads differently from a brand-new application.
 */
export function ReconsiderControl({
  application,
  firstStageId,
  onBefore,
  onCaptureUndo,
  onDone,
}: {
  application: ApplicationWithRelations;
  /** The pipeline's first stage, where they start again. */
  firstStageId: string | undefined;
  /** Saves what is typed in the pop-up before the card moves. */
  onBefore?: () => Promise<void>;
  /** Records the rejected card as it is, for the board's Undo button, before it is reopened. */
  onCaptureUndo?: (label: string) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState(application.job.company.id);
  const [jobId, setJobId] = useState(application.job.id);
  const [error, setError] = useState<string | null>(null);

  // every time it's opened, start from "reconsider for the same job" again
  useEffect(() => {
    if (open) {
      setCompanyId(application.job.company.id);
      setJobId(application.job.id);
      setError(null);
    }
  }, [open, application.job.company.id, application.job.id]);

  const { data: companies } = useCompanies({ pageSize: 100 }, { enabled: open });
  const { data: jobs } = useJobs(open && companyId ? { pageSize: 100, status: 'OPEN', companyId } : { pageSize: 1 });
  const createApplication = useCreateApplication();

  const sortedCompanies = useMemo(() => [...(companies?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [companies]);
  // the job they were rejected for stays pickable even if it's no longer OPEN — that's the point of defaulting to it
  const openJobs = useMemo(() => {
    const items = open && companyId ? (jobs?.items ?? []) : [];
    if (companyId === application.job.company.id && !items.some((j) => j.id === application.job.id)) {
      return [{ id: application.job.id, title: application.job.title }, ...items];
    }
    return items;
  }, [open, companyId, jobs, application.job.company.id, application.job.id, application.job.title]);

  async function reconsider() {
    setError(null);
    try {
      const who = `${application.candidate.firstName} ${application.candidate.lastName}`;
      // the same job reopens this very card — Undo puts it back in Rejected as it was
      if (jobId === application.job.id) await onCaptureUndo?.(`Reconsidered ${who}`);
      await onBefore?.();
      const created = await createApplication.mutateAsync({
        candidateId: application.candidate.id,
        jobId,
        pipelineId: application.pipelineId,
        pipelineStageId: firstStageId,
      });
      // marks the New card "Reconsidered" rather than a first-time application (see stageStatus's 'new' case)
      if (firstStageId) await upsertStageNote(created.id, firstStageId, { fields: { source: 'Reconsidered' } });
      // another job made a new card — Undo takes that card off again
      if (created.id !== application.id) {
        pushUndo({ label: `Reconsidered ${who} for another job`, applicationId: created.id, kind: 'created', stageId: firstStageId ?? '', notes: {} });
      }
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reconsider this candidate.');
    }
  }

  return (
    <>
      <Button type="button" className={TONES.blue.button} onClick={() => setOpen(true)}>
        <RotateCcw className="mr-1.5 h-4 w-4" /> Reconsider
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={setOpen}
          title="Reconsider"
          description="Back to New — for the same job by default, or pick another one below. Both are optional."
        >
          <div className="flex flex-col gap-3" data-testid="reconsider">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reconsider-company" className="text-xs font-medium">
                Company (optional)
              </label>
              <SearchSelect
                id="reconsider-company"
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setJobId('');
                }}
              >
                <option value="">Choose the company…</option>
                {sortedCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </SearchSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reconsider-job" className="text-xs font-medium">
                Job (optional)
              </label>
              <SearchSelect id="reconsider-job" value={jobId} disabled={!companyId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">{!companyId ? 'Choose the company first' : openJobs.length === 0 ? 'No open jobs at this company' : 'Choose the job…'}</option>
                {openJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                    {job.id === application.job.id ? ' (the job they were rejected for)' : ''}
                  </option>
                ))}
              </SearchSelect>
            </div>
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={createApplication.isPending}>
                Cancel
              </Button>
              <Button type="button" className={TONES.blue.button} disabled={!jobId || createApplication.isPending} onClick={() => void reconsider()}>
                {createApplication.isPending ? 'Moving…' : 'Reconsider — back to New'}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
