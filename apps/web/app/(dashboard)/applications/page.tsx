'use client';

import { PlacementsView } from '@/features/placements';

/**
 * "Placements" here means someone who has actually won the job — gone
 * through a pipeline to a "Placed"-type stage (see /pipeline) and been
 * assigned to a job + company. That happens automatically the moment an
 * Application reaches that stage; recording one by hand happens from a
 * company's own page (/companies/[id] -> Employees -> Add), in context of
 * who they'll work for. This page is edit/correct-after-the-fact only, not
 * an entry point — there's no "add to pipeline" here on purpose, since
 * everyone on this list has already been through that step.
 *
 * Only employments that are still running are listed: Terminate / Contracted
 * in the pipeline pop-up move the person to Completed Contract
 * (/completed-contracts).
 *
 * Everyone NOT yet at this stage — ranked candidates still being considered
 * and people actively moving through a pipeline — lives in /candidates and
 * /pipeline, not here.
 */
export default function PlacementsPage() {
  return (
    <PlacementsView
      title="Active Employees"
      description="Everyone who has already won the job and been accepted — hired, with job, company, and start date. Still being considered? Check /pipeline; brand-new leads are ranked at /candidates."
      status="ACTIVE"
      splitView={{
        toggleLabel: 'Permanent / Temporary',
        hideColumn: 'type',
        left: { label: 'Permanent', employmentType: 'PERMANENT', emptyMessage: 'No permanent employees.' },
        right: { label: 'Temporary', employmentType: 'TEMPORARY', emptyMessage: 'No temporary employees.' },
      }}
      empty={{
        title: 'No placements yet',
        text: 'Move an applicant through /pipeline to the hired stage to have them show up here automatically, or add one from a company’s Employees section.',
      }}
    />
  );
}
