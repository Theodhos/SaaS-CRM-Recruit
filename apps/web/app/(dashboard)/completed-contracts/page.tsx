'use client';

import { Label, Select } from '@crm/ui';
import { useState } from 'react';

import { PlacementsView } from '@/features/placements';

type Outcome = 'COMPLETED,CANCELLED' | 'COMPLETED' | 'CANCELLED';

/**
 * Employments that are over, by how they ended: Completed or Terminated (Active Employees' two buttons) — both
 * remove the card from the pipeline and land here instead. Shows both together by default, so a fresh Terminated
 * or Completed shows up right away without picking a filter first; the dropdown narrows to just one outcome.
 */
export default function CompletedContractsPage() {
  const [outcome, setOutcome] = useState<Outcome>('COMPLETED,CANCELLED');

  return (
    <PlacementsView
      // a fresh list (page 1, no search) per outcome
      key={outcome}
      title="Completed Contract"
      description="Employees whose contract is over — completed, or terminated before its end."
      status={outcome}
      splitView={{
        toggleLabel: 'Terminated / Completed',
        hideColumn: 'status',
        left: { label: 'Terminated', status: 'CANCELLED', emptyMessage: 'No terminated contracts.' },
        right: { label: 'Completed', status: 'COMPLETED', emptyMessage: 'No completed contracts yet.' },
      }}
      filters={
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-outcome">Show</Label>
          <Select id="contract-outcome" className="w-44" value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)}>
            <option value="COMPLETED,CANCELLED">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Terminated</option>
          </Select>
        </div>
      }
      empty={
        outcome === 'COMPLETED'
          ? { title: 'No completed contracts yet', text: 'Press Completed in the pipeline pop-up of an active employee to list them here.' }
          : outcome === 'CANCELLED'
            ? { title: 'No terminated contracts', text: 'Press Terminated in the pipeline pop-up of an active employee to list them here.' }
            : { title: 'No closed contracts yet', text: 'Press Completed or Terminated in the pipeline pop-up of an active employee to list them here.' }
      }
    />
  );
}
