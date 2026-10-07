'use client';

import { Button, Textarea } from '@crm/ui';
import { Loader2, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Edits a CV that is a plain text file: the whole text is in the box, anything can be deleted or rewritten. Saving
 * makes a NEW document beside the original; the original is never changed.
 */
export function TextEditor({
  source,
  onSave,
  onCancel,
}: {
  /** A blob: URL of the text as it is now. */
  source: string;
  onSave: (file: File) => Promise<void>;
  onCancel: () => void;
}) {
  const [original, setOriginal] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(source)
      .then((response) => response.text())
      .then((loaded) => {
        if (cancelled) return;
        setOriginal(loaded);
        setText(loaded);
      })
      .catch(() => !cancelled && setError('This text could not be opened for editing.'));
    return () => {
      cancelled = true;
    };
  }, [source]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(new File([text], 'edited.txt', { type: 'text/plain' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The edited CV could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background" data-testid="text-editor">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs text-foreground/50">The original CV stays as it is — saving keeps the edited CV as a separate copy next to it.</span>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" disabled={saving} onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={saving || original === null || text === original} onClick={() => void save()} data-testid="text-save">
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save as a new copy'}
        </Button>
      </div>
      {error ? (
        <p className="shrink-0 bg-red-50 px-3 py-1.5 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={original === null}
        className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
        data-testid="text-editor-box"
      />
    </div>
  );
}
