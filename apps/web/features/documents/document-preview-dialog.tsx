'use client';

import { Dialog } from '@crm/ui';
import { Download } from 'lucide-react';

import { previewFrameSrc, useDocumentPreview, type PreviewableDocument } from './use-document-preview';

export type { PreviewableDocument } from './use-document-preview';

/**
 * Shows a document inside the platform instead of downloading it: PDF, images and text as they are, Word (.docx)
 * as the page the API converts it to (GET /documents/:id/preview). Anything else offers the download.
 */
export function DocumentPreviewDialog({ document, onClose }: { document: PreviewableDocument; onClose: () => void }) {
  const { preview, error } = useDocumentPreview(document.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={document.name} className="max-h-[94vh] max-w-5xl overflow-y-auto">
      <div className="flex flex-col gap-3" data-testid="document-preview">
        {error ? (
          <p className="py-10 text-center text-sm text-foreground/60" role="alert">
            {error}
          </p>
        ) : !preview ? (
          <p className="py-10 text-center text-sm text-foreground/50">Loading preview…</p>
        ) : preview.type.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob: URL, nothing for next/image to optimise
          <img src={preview.url} alt={document.name} className="mx-auto max-h-[75vh] rounded-md border border-border" />
        ) : (
          <iframe
            src={previewFrameSrc(preview)}
            title={document.name}
            className="h-[75vh] w-full rounded-md border border-border bg-white"
            // a converted Word file is someone else's HTML: no scripts, no access to the platform
            sandbox={preview.type.startsWith('text/html') ? '' : undefined}
          />
        )}
        <div className="flex justify-end">
          <a
            href={document.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>
    </Dialog>
  );
}
