import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { GitBranch, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import type { AddedBy } from '@/hooks/use-added-by';
import { CANDIDATE_STATUS_COLOUR, POTENTIAL_COLOUR, REVIEW_STATUS_COLOUR } from '@/lib/status-colors';
import type { CandidateWithCompany, SuggestedJob } from '@/services/candidates.service';

const STATUS_VARIANT = CANDIDATE_STATUS_COLOUR;

// The table shows the three real states; REAPPLIED / SUGGESTED are filters whose rows are Active / Rejected people.
const REVIEW_VARIANT = REVIEW_STATUS_COLOUR;
const REVIEW_LABEL: Record<CandidateWithCompany['reviewStatus'], string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  REAPPLIED: 'Active',
  SUGGESTED: 'Rejected',
};

const POTENTIAL_VARIANT = POTENTIAL_COLOUR;

export function candidateColumns(options: {
  onEdit: (candidate: CandidateWithCompany) => void;
  onDelete: (candidate: CandidateWithCompany) => void;
}): ColumnDef<CandidateWithCompany, unknown>[] {
  return [
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: ({ row }) => (
        <Link href={`/candidates/${row.original.id}`} className="font-medium hover:underline">
          {row.original.firstName} {row.original.lastName}
        </Link>
      ),
    },
    { header: 'Job Title', accessorKey: 'jobTitle', cell: ({ row }) => row.original.jobTitle ?? '—' },
    {
      header: 'Company',
      accessorKey: 'currentCompany',
      cell: ({ row }) =>
        row.original.company ? (
          <Link href={`/companies/${row.original.company.id}`} className="hover:underline">
            {row.original.company.name}
          </Link>
        ) : (
          (row.original.currentCompany ?? '—')
        ),
    },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '—' },
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => row.original.location ?? '—' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {row.original.status.replaceAll('_', ' ')}
        </Badge>
      ),
    },
    {
      header: 'Added',
      accessorKey: 'createdAt',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
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

/**
 * The Candidates directory — everyone who applied (website form or added by hand). New arrivals go straight onto
 * the pipeline of the job they want, so there is no "add to pipeline" action here: the Status column reads their
 * pipeline stage, and the row links to that pipeline.
 */
export function unassignedCandidateColumns(options: {
  /** With the "Suggested for open jobs" filter: show the openings and let one click put the person on that pipeline. */
  suggestions?: { onApply: (candidate: CandidateWithCompany, job: SuggestedJob) => void; pendingKey: string | null };
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  addedBy?: AddedBy;
} = {}): ColumnDef<CandidateWithCompany, unknown>[] {
  const suggestionColumn: ColumnDef<CandidateWithCompany, unknown>[] = options.suggestions
    ? [
        {
          id: 'suggestions',
          header: 'Suggested openings',
          cell: ({ row }) => (
            <ul className="flex flex-col gap-1.5">
              {(row.original.suggestedJobs ?? []).map((job) => {
                const key = `${row.original.id}:${job.id}`;
                return (
                  <li key={job.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span>
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                        {job.title}
                      </Link>
                      {job.company ? <span className="text-foreground/50"> · {job.company.name}</span> : null}
                      <span className="block text-foreground/40">similar to “{job.matchedOn}”</span>
                    </span>
                    <Button type="button" size="sm" variant="outline" disabled={options.suggestions!.pendingKey === key} onClick={() => options.suggestions!.onApply(row.original, job)}>
                      <GitBranch className="mr-1 h-3 w-3" /> {options.suggestions!.pendingKey === key ? 'Adding…' : 'Put on pipeline'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ),
        },
      ]
    : [];
  return [
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: ({ row }) => (
        <Link href={`/candidates/${row.original.id}`} className="font-medium hover:underline">
          {row.original.firstName} {row.original.lastName}
        </Link>
      ),
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ row }) =>
        row.original.phone ? (
          <a href={`tel:${row.original.phone}`} className="hover:underline">
            {row.original.phone}
          </a>
        ) : (
          '—'
        ),
    },
    {
      // The job this person is after (chosen on the website form, in the Add Candidate form, or on their profile).
      header: 'Interested in',
      id: 'interestedJob',
      cell: ({ row }) =>
        row.original.interestedJob ? (
          <div className="flex flex-col">
            <Link href={`/jobs/${row.original.interestedJob.id}`} className="hover:underline">
              {row.original.interestedJob.title}
            </Link>
            {row.original.interestedJob.company ? (
              <span className="text-xs text-foreground/50">{row.original.interestedJob.company.name}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-foreground/40">Any open position</span>
        ),
    },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '—' },
    {
      // Exactly three states, all read off the pipeline: Active (on a pipeline — New … Offer, or hired), Rejected
      // (in a Rejected stage) and Pending (not on a pipeline yet). Rejected applicants stay in this table.
      header: 'Status',
      accessorKey: 'reviewStatus',
      cell: ({ row }) => <Badge variant={REVIEW_VARIANT[row.original.reviewStatus]}>{REVIEW_LABEL[row.original.reviewStatus]}</Badge>,
    },
    {
      header: 'Potential',
      accessorKey: 'potentialLabel',
      cell: ({ row }) => (
        <Badge variant={POTENTIAL_VARIANT[row.original.potentialLabel]}>
          {row.original.potentialLabel} · {row.original.potentialScore}%
        </Badge>
      ),
    },
    ...suggestionColumn,
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
      cell: ({ row }) => {
        const current = row.original.currentApplication;
        if (!current) return null;
        return (
          <div className="flex justify-end">
            <Link
              href={`/pipeline?pipelineId=${current.pipelineId}&jobId=${current.jobId}&candidateId=${row.original.id}`}
              className="inline-flex items-center text-xs font-medium text-primary hover:underline"
            >
              <GitBranch className="mr-1 h-3.5 w-3.5" /> Open in pipeline
            </Link>
          </div>
        );
      },
    },
  ];
}
