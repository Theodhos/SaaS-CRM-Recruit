'use client';

import { cn } from '@crm/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Download, GripHorizontal, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { saveEditedDocument } from '@/services/documents.service';

import { PdfEditor } from './pdf-editor';
import { TextEditor } from './text-editor';
import { previewFrameSrc, useDocumentPreview, type PreviewableDocument } from './use-document-preview';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const MARGIN = 16;
const HEADER_HEIGHT = 44;

/**
 * Where the window first appears: the right 45% of the screen, as tall as the stage pop-up (92vh, 4vh from the top)
 * — the pop-up it was opened from slides to the left to make room (see the `.cv-window` rule on the stage dialog).
 */
function startPlacement() {
  if (typeof window === 'undefined') return { x: MARGIN, y: 72, width: 720, height: 640 };
  const width = Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.45) - MARGIN);
  const height = Math.max(MIN_HEIGHT, Math.round(window.innerHeight * 0.92));
  return { x: Math.max(MARGIN, window.innerWidth - width - MARGIN), y: Math.round(window.innerHeight * 0.04), width, height };
}

/**
 * The same preview as DocumentPreviewDialog, but as a floating window instead of a modal: whatever it is opened
 * over (a stage pop-up) stays open and usable, and the window can be dragged anywhere by its title bar and
 * resized from its bottom-right corner. Render it inside the element it floats over — inside a <dialog>, that is
 * what keeps it clickable while the dialog is modal.
 */
export function DocumentPreviewWindow({
  document,
  onClose,
  onEdited,
}: {
  document: PreviewableDocument;
  onClose: () => void;
  /** The edited copy that was just saved (a new document beside this one) — the window can switch to showing it. */
  onEdited?: (edited: PreviewableDocument) => void;
}) {
  const { preview, error } = useDocumentPreview(document.id);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;
  // PDF and plain text can be edited — mainly, text taken out; anything else is view-only
  const editable = Boolean(preview) && (preview!.type === 'application/pdf' || preview!.type.startsWith('text/plain'));

  async function saveEdited(file: File) {
    const created = await saveEditedDocument(document.id, file);
    await queryClient.invalidateQueries({ queryKey: ['documents'] });
    setEditing(false);
    onEdited?.(created);
  }
  const [placement] = useState(startPlacement);
  const [position, setPosition] = useState({ x: placement.x, y: placement.y });
  const [dragging, setDragging] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  // Esc closes the window first — not the pop-up under it (preventing the keydown stops the <dialog> cancel)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      // while editing, Esc must not throw the edits away
      if (!editingRef.current) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    grab.current = { dx: event.clientX - position.x, dy: event.clientY - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!grab.current) return;
    const width = frame.current?.offsetWidth ?? placement.width;
    // the title bar always stays reachable: the window cannot be pushed off the screen
    const x = Math.min(Math.max(event.clientX - grab.current.dx, MARGIN - width + 120), window.innerWidth - 120);
    const y = Math.min(Math.max(event.clientY - grab.current.dy, 0), window.innerHeight - HEADER_HEIGHT);
    setPosition({ x, y });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!grab.current) return;
    grab.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }

  return (
    <div
      ref={frame}
      role="dialog"
      aria-label={document.name}
      data-testid="document-preview-window"
      // `cv-window` is what the pop-up underneath looks for to slide aside
      className="cv-window fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        width: placement.width,
        height: placement.height,
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        maxWidth: `calc(100vw - ${MARGIN}px)`,
        maxHeight: `calc(100vh - ${MARGIN}px)`,
        resize: 'both',
      }}
    >
      <div
        className={cn(
          'flex shrink-0 touch-none select-none items-center gap-2 border-b border-border bg-accent/40 px-3',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ height: HEADER_HEIGHT }}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="document-preview-handle"
      >
        <GripHorizontal className="h-4 w-4 shrink-0 text-foreground/40" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{document.name}</span>
        {editable && !editing ? (
          <button
            type="button"
            title="Edit — remove text from this CV"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setEditing(true)}
            data-testid="document-edit"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        ) : null}
        <a
          href={document.downloadUrl}
          target="_blank"
          rel="noreferrer"
          title="Download"
          className="rounded-md p-1 text-foreground/50 hover:bg-accent hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          type="button"
          aria-label="Close preview"
          className="rounded-md p-1 text-foreground/50 hover:bg-accent hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className={cn('min-h-0 flex-1 bg-white', editing ? 'overflow-hidden' : 'overflow-auto', dragging && 'pointer-events-none')}
        data-testid="document-preview"
      >
        {editing && preview ? (
          preview.type === 'application/pdf' ? (
            <PdfEditor source={preview.url} onSave={saveEdited} onCancel={() => setEditing(false)} />
          ) : (
            <TextEditor source={preview.url} onSave={saveEdited} onCancel={() => setEditing(false)} />
          )
        ) : error ? (
          <p className="py-10 text-center text-sm text-foreground/60" role="alert">
            {error}
          </p>
        ) : !preview ? (
          <p className="py-10 text-center text-sm text-foreground/50">Loading preview…</p>
        ) : preview.type.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob: URL, nothing for next/image to optimise
          <img src={preview.url} alt={document.name} className="mx-auto max-w-full" />
        ) : (
          <iframe
            src={previewFrameSrc(preview)}
            title={document.name}
            className="h-full w-full"
            // a converted Word file is someone else's HTML: no scripts, no access to the platform
            sandbox={preview.type.startsWith('text/html') ? '' : undefined}
          />
        )}
      </div>
    </div>
  );
}
