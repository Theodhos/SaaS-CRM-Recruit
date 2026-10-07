'use client';

import { Button, cn } from '@crm/ui';
import { Eraser, Loader2, MousePointerClick, Save, Square, Undo2, X } from 'lucide-react';
import type * as Pdfjs from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type PDFDocumentProxy = Pdfjs.PDFDocumentProxy;
type PDFPageProxy = Pdfjs.PDFPageProxy;

type Tool = 'text' | 'erase' | 'black';

/** A removed area of a page, as fractions of the page (0–1) so it does not depend on the zoom it was drawn at. */
interface Box {
  id: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: 'white' | 'black';
}

/** One piece of text the PDF draws, with where it sits on the page (fractions of the page). */
interface Run {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

const EXPORT_SCALE = 2.5; // 2.5 × 72 = 180 dpi for the pages that were edited
const MIN_BOX = 0.004;

let pdfjsPromise: Promise<typeof Pdfjs> | null = null;
function loadPdfjs() {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * Edits a CV that is a PDF — mainly, takes text OUT of it. "Click text" removes the piece of text you click, "Erase"
 * and "Black out" remove whatever area you drag over. The removal is real: a page that was edited is rebuilt as an
 * image with those areas painted over, so the text is gone from the file and cannot be copied or searched. Pages
 * left untouched stay exactly as they were. Saving makes a NEW document beside the original; the original is never
 * changed.
 */
export function PdfEditor({
  source,
  onSave,
  onCancel,
}: {
  /** A blob: URL of the PDF as it is now. */
  source: string;
  /** Receives the edited PDF; rejects with the reason when it could not be saved. */
  onSave: (file: File) => Promise<void>;
  onCancel: () => void;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('text');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [width, setWidth] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // the PDF, read once: pdfjs draws it, pdf-lib rebuilds it
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const buffer = new Uint8Array(await (await fetch(source)).arrayBuffer());
        const pdfjs = await loadPdfjs();
        doc = await pdfjs.getDocument({ data: buffer.slice() }).promise;
        const loaded = await Promise.all(Array.from({ length: doc.numPages }, (_, index) => doc!.getPage(index + 1)));
        if (cancelled) return;
        setBytes(buffer);
        setPages(loaded);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'This PDF could not be opened for editing.');
      }
    })();
    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [source]);

  // pages are drawn as wide as the window, and follow it when it is resized
  useEffect(() => {
    const node = area.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(240, Math.floor(node.clientWidth - 32)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const addBox = useCallback((box: Omit<Box, 'id'>) => setBoxes((list) => [...list, { ...box, id: nextId.current++ }]), []);
  const removeBox = useCallback((id: number) => setBoxes((list) => list.filter((box) => box.id !== id)), []);

  async function save() {
    if (!bytes || boxes.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const source = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      for (let index = 0; index < pages.length; index++) {
        const mine = boxes.filter((box) => box.page === index);
        if (mine.length === 0) {
          const [copy] = await out.copyPages(source, [index]);
          out.addPage(copy!);
          continue;
        }
        const page = pages[index]!;
        const points = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: EXPORT_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        for (const box of mine) {
          context.fillStyle = box.color === 'black' ? '#000' : '#fff';
          context.fillRect(box.x * canvas.width, box.y * canvas.height, box.w * canvas.width, box.h * canvas.height);
        }
        const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (!jpeg) throw new Error('A page could not be rendered.');
        const image = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
        const target = out.addPage([points.width, points.height]);
        target.drawImage(image, { x: 0, y: 0, width: points.width, height: points.height });
      }
      const edited = await out.save();
      await onSave(new File([edited.slice().buffer as ArrayBuffer], 'edited.pdf', { type: 'application/pdf' }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'The edited CV could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const tools: { id: Tool; label: string; hint: string; icon: typeof Eraser }[] = [
    { id: 'text', label: 'Click text', hint: 'Click a piece of text to remove it', icon: MousePointerClick },
    { id: 'erase', label: 'Erase area', hint: 'Drag over anything to wipe it out', icon: Eraser },
    { id: 'black', label: 'Black out', hint: 'Drag over anything to cover it with black', icon: Square },
  ];

  return (
    <div className="flex h-full flex-col bg-accent/20" data-testid="pdf-editor">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2">
        {tools.map(({ id, label, hint, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tool === id ? 'default' : 'outline'}
            title={hint}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
            data-testid={`pdf-tool-${id}`}
          >
            <Icon className="mr-1 h-3.5 w-3.5" /> {label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" disabled={boxes.length === 0 || saving} onClick={() => setBoxes((list) => list.slice(0, -1))} data-testid="pdf-undo">
          <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
        </Button>
        <span className="ml-auto text-xs text-foreground/50" data-testid="pdf-removed-count">
          {boxes.length === 0 ? 'Nothing removed yet' : `${boxes.length} removed`}
        </span>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel} data-testid="pdf-cancel">
          <X className="mr-1 h-3.5 w-3.5" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={boxes.length === 0 || saving || !bytes} onClick={() => void save()} data-testid="pdf-save">
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save as a new copy'}
        </Button>
      </div>
      {saveError ? (
        <p className="shrink-0 bg-red-50 px-3 py-1.5 text-xs text-red-700" role="alert">
          {saveError}
        </p>
      ) : (
        <p className="shrink-0 px-3 py-1.5 text-xs text-foreground/50">
          The original CV stays as it is — saving keeps the edited CV as a separate copy next to it.
        </p>
      )}
      <div ref={area} className="min-h-0 flex-1 overflow-auto px-4 pb-4" data-testid="pdf-editor-pages">
        {loadError ? (
          <p className="py-10 text-center text-sm text-red-600" role="alert">
            {loadError}
          </p>
        ) : pages.length === 0 || width === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/50">Opening the CV for editing…</p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {pages.map((page, index) => (
              <PageView
                key={index}
                page={page}
                pageIndex={index}
                width={width}
                tool={tool}
                boxes={boxes.filter((box) => box.page === index)}
                onAdd={addBox}
                onRemove={removeBox}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PageView({
  page,
  pageIndex,
  width,
  tool,
  boxes,
  onAdd,
  onRemove,
}: {
  page: PDFPageProxy;
  pageIndex: number;
  width: number;
  tool: Tool;
  boxes: Box[];
  onAdd: (box: Omit<Box, 'id'>) => void;
  onRemove: (id: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const natural = page.getViewport({ scale: 1 });
  const height = Math.round((width * natural.height) / natural.width);

  // the page itself, at the window's width
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ratio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: (width / natural.width) * ratio });
    node.width = Math.floor(viewport.width);
    node.height = Math.floor(viewport.height);
    const task = page.render({ canvasContext: node.getContext('2d')!, viewport });
    task.promise.catch(() => undefined); // a render cancelled by a resize is not an error
    return () => task.cancel();
  }, [page, width, natural.width]);

  // where each piece of text sits, for "Click text"
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await loadPdfjs();
      const content = await page.getTextContent();
      const found: Run[] = [];
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        const t = pdfjs.Util.transform(natural.transform, item.transform);
        const size = Math.hypot(t[2]!, t[3]!);
        const top = t[5]! - size * 0.92;
        found.push({
          x: Math.max(0, (t[0] === 0 ? t[4]! : t[4]!) - 1.5) / natural.width,
          y: Math.max(0, top - 1.5) / natural.height,
          w: (item.width + 3) / natural.width,
          h: (size * 1.25 + 3) / natural.height,
          text: item.str,
        });
      }
      if (!cancelled) setRuns(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [page, natural.width, natural.height, natural.transform]);

  const point = (event: ReactPointerEvent) => {
    const rect = overlay.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const drawing = tool !== 'text';

  return (
    <div className="relative shrink-0 bg-white shadow-md" style={{ width, height }} data-testid="pdf-page">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div
        ref={overlay}
        className={cn('absolute inset-0', drawing ? 'cursor-crosshair' : 'cursor-default')}
        onPointerDown={(event) => {
          if (!drawing || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event);
          setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onPointerMove={(event) => {
          if (!drag) return;
          const p = point(event);
          setDrag({ ...drag, x1: p.x, y1: p.y });
        }}
        onPointerUp={() => {
          if (!drag) return;
          const box = { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };
          setDrag(null);
          if (box.w > MIN_BOX && box.h > MIN_BOX) onAdd({ page: pageIndex, ...box, color: tool === 'black' ? 'black' : 'white' });
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {tool === 'text'
          ? runs.map((run, index) => (
              <button
                key={index}
                type="button"
                title={`Remove “${run.text.trim().slice(0, 60)}”`}
                data-testid="pdf-text-run"
                className="absolute rounded-sm bg-sky-400/0 outline-1 outline-sky-500/0 hover:bg-sky-400/30 hover:outline hover:outline-sky-500"
                style={{ left: `${run.x * 100}%`, top: `${run.y * 100}%`, width: `${run.w * 100}%`, height: `${run.h * 100}%` }}
                onClick={() => onAdd({ page: pageIndex, x: run.x, y: run.y, w: run.w, h: run.h, color: 'white' })}
              />
            ))
          : null}
        {boxes.map((box) => (
          <div
            key={box.id}
            data-testid="pdf-box"
            className={cn('group absolute', box.color === 'black' ? 'bg-black' : 'bg-white outline-dashed outline-1 outline-red-400')}
            style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
          >
            <button
              type="button"
              aria-label="Undo this removal"
              title="Put this back"
              className="absolute -right-2 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white group-hover:flex"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onRemove(box.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {drag ? (
          <div
            className={cn('absolute outline-dashed outline-1', tool === 'black' ? 'bg-black/70 outline-black' : 'bg-red-400/20 outline-red-500')}
            style={{
              left: `${Math.min(drag.x0, drag.x1) * 100}%`,
              top: `${Math.min(drag.y0, drag.y1) * 100}%`,
              width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
              height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
