'use client';

import { Button, Dialog } from '@crm/ui';
import { Eye, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

import { DocumentPreviewDialog } from '@/features/documents';
import { useDocuments, useUploadDocument } from '@/hooks/use-documents';
import type { DocumentWithRelations } from '@/services/documents.service';
import type { PlacementWithRelations } from '@/services/placements.service';

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fileSize = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * Opens when an employee is clicked on Active Employees / Completed Contract: everything that was uploaded for that
 * person (CV, contract, whatever was added along the pipeline), each with a preview inside the platform, and
 * "Add document". This replaces the former Documents page.
 */
export function EmployeeDocumentsDialog({ placement, onClose }: { placement: PlacementWithRelations; onClose: () => void }) {
  const { data, isLoading } = useDocuments({ candidateId: placement.candidate.id, pageSize: 100 });
  const upload = useUploadDocument();
  const input = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState<DocumentWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({
        file,
        type: 'OTHER',
        candidateId: placement.candidate.id,
        placementId: placement.id,
        jobId: placement.job.id,
        companyId: placement.company.id,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the document.');
    }
  }

  const documents = data?.items ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${placement.candidate.firstName} ${placement.candidate.lastName} · documents`}
      description={`${placement.job.title} · ${placement.company.name}`}
      className="max-h-[92vh] max-w-3xl overflow-y-auto"
    >
      <div className="flex flex-col gap-3" data-testid="employee-documents">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-foreground/50">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">No documents uploaded for this person yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border text-sm">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{document.name}</p>
                  <p className="text-xs text-foreground/50">
                    {label(document.type)} · {fileSize(document.fileSize)} · {day(document.createdAt)}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => setPreviewing(document)}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                </Button>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <input
            ref={input}
            type="file"
            accept={DOCUMENT_ACCEPT}
            className="hidden"
            data-testid="employee-document-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void add(file);
            }}
          />
          <Button type="button" disabled={upload.isPending} onClick={() => input.current?.click()}>
            <Plus className="mr-1.5 h-4 w-4" /> {upload.isPending ? 'Uploading…' : 'Add document'}
          </Button>
        </div>
      </div>

      {previewing ? <DocumentPreviewDialog document={previewing} onClose={() => setPreviewing(null)} /> : null}
    </Dialog>
  );
}
