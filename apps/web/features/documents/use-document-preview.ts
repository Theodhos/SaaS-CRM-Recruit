'use client';

import { useEffect, useState } from 'react';

import { apiBlob } from '@/lib/api-client';

export interface PreviewableDocument {
  id: string;
  name: string;
  downloadUrl: string;
}

export interface DocumentPreview {
  url: string;
  type: string;
}

/**
 * What to load in the preview <iframe>: a PDF opens in the browser's own viewer, and the `navpanes=0` open
 * parameter (Chrome, Edge) hides its thumbnail/outline sidebar so only the page itself shows.
 */
export function previewFrameSrc(preview: DocumentPreview) {
  return preview.type === 'application/pdf' ? `${preview.url}#navpanes=0` : preview.url;
}

/**
 * Fetches a document as the platform shows it (GET /documents/:id/preview): PDF, images and text as they are,
 * Word (.docx) as the page the API converts it to. The blob: URL is released when the document changes or unmounts.
 */
export function useDocumentPreview(documentId: string) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setPreview(null);
    setError(null);
    apiBlob(`/documents/${documentId}/preview`)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, type: blob.type });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not open this document.'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentId]);

  return { preview, error };
}
