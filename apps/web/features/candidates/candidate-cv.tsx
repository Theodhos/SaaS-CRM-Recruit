'use client';

import { Button } from '@crm/ui';
import { Eye, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { DocumentPreviewDialog } from '@/features/documents';
import { useDeleteDocument, useDocuments, useUploadDocument } from '@/hooks/use-documents';
import type { DocumentWithRelations } from '@/services/documents.service';

const CV_TYPES = new Set(['CV', 'RESUME']);
const CV_ACCEPT = '.pdf,.docx,.txt,.png,.jpg,.jpeg';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fileSize = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** The CVs on file for a candidate, newest first — and, apart from them, whatever else was uploaded (`others`). */
export function useCandidateCvs(candidateId: string | undefined) {
  const query = useDocuments({ candidateId, pageSize: 50 });
  const all = candidateId ? (query.data?.items ?? []) : [];
  return { ...query, cvs: all.filter((d) => CV_TYPES.has(d.type)), others: all.filter((d) => !CV_TYPES.has(d.type)) };
}

/**
 * The candidate's CV: kept with the person when they are added (the file dropped in the Add Candidate form),
 * uploaded here later, and opened inside the platform with Preview.
 */
export function CandidateCv({ candidateId }: { candidateId: string }) {
  const { cvs, isLoading } = useCandidateCvs(candidateId);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState<DocumentWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({ file, type: 'CV', candidateId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the CV.');
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="candidate-cv">
      {isLoading ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : cvs.length === 0 ? (
        <p className="text-sm text-foreground/50">No CV on file yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {cvs.map((cv) => (
            <li key={cv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{cv.name}</p>
                <p className="text-xs text-foreground/50">
                  {fileSize(cv.fileSize)} · {day(cv.createdAt)}
                  {cv.uploadedBy ? ` · ${cv.uploadedBy.firstName} ${cv.uploadedBy.lastName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => setPreviewing(cv)}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Delete CV"
                  disabled={remove.isPending}
                  onClick={() => window.confirm(`Delete ${cv.name}?`) && remove.mutate(cv.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <input
          ref={fileInput}
          type="file"
          accept={CV_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void handleFile(file);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" /> {upload.isPending ? 'Uploading…' : 'Upload CV'}
        </Button>
      </div>

      {previewing ? <DocumentPreviewDialog document={previewing} onClose={() => setPreviewing(null)} /> : null}
    </div>
  );
}
