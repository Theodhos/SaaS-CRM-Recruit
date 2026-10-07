'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from '@crm/ui';
import { Pencil, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * A section that holds text only: it is shown as it was saved, Edit turns it into a text box, Save keeps it.
 * `asList` shows one bullet per line (job duties, requirements); otherwise the text keeps its own paragraphs.
 */
export function EditableTextCard({
  title,
  icon: Icon,
  value,
  onSave,
  placeholder,
  emptyText = 'Nothing written yet.',
  asList = false,
  testId,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  value: string | null | undefined;
  onSave: (text: string) => Promise<unknown>;
  placeholder?: string;
  emptyText?: string;
  asList?: boolean;
  testId?: string;
  /** Fixed facts shown above the text (a job's experience range, its salary). */
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = (value ?? '').trim();
  // a line typed with its own "- " or "• " is still one bullet
  const lines = saved.split('\n').map((line) => line.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(text.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon ? <Icon className="h-4 w-4 text-foreground/50" /> : null} {title}
        </CardTitle>
        {editing ? null : (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setText(saved);
              setEditing(true);
            }}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> {saved ? 'Edit' : 'Add'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              aria-label={title}
              rows={Math.min(14, Math.max(5, text.split('\n').length + 1))}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
            {asList ? <p className="text-xs text-foreground/50">One item per line.</p> : null}
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" disabled={saving} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : !saved ? (
          <p className="text-sm text-foreground/50">{emptyText}</p>
        ) : asList ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {lines.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{saved}</p>
        )}
      </CardContent>
    </Card>
  );
}
