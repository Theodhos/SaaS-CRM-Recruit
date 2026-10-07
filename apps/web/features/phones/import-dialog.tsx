'use client';

import { Badge, Button, Dialog, Input, Label } from '@crm/ui';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useConfirmPhoneImport, usePhoneImport } from '@/hooks/use-phones';
import { getPhoneImportErrors, previewPhoneImport, type ImportPreview } from '@/services/phones.service';

const ROW_VARIANT = { valid: 'success', invalid: 'destructive', duplicate: 'warning', duplicate_in_file: 'warning' } as const;

/** The four columns a Phones sheet holds; anything else the platform fills in itself. Phone is the only required one. */
const TEMPLATE_HEADERS = ['Name', 'Phone', 'Email', 'Company'] as const;

/** Numbers written without a country code are read as Albanian (+355). */
const DEFAULT_COUNTRY = 'AL';

/** Downloads an Excel workbook with exactly those headers and one sample row, so it is filled in and re-uploaded. */
async function downloadTemplate() {
  // SheetJS is loaded only when the template is asked for — it is not part of the page otherwise
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], ['Filan Fisteku', '0691234567', 'filan@example.com', 'Acme Sh.p.k.']]);
  sheet['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 24 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Phones');
  XLSX.writeFile(workbook, 'phones-template.xlsx');
}

/** Excel workbooks only — the file picker shows nothing else, and anything else picked by other means is refused. */
const EXCEL_ACCEPT = '.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
const isExcelFile = (file: File) => /\.(xlsx|xls|xlsm)$/i.test(file.name);

/**
 * Excel → Phones in two steps: the file is parsed, normalised and checked server-side and shown as a PREVIEW (counts +
 * first rows with their status); nothing is written until "Import N phones". The import then runs in batches on the
 * server while this dialog polls its progress and finally offers the error report.
 */
export function PhoneImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const confirm = useConfirmPhoneImport();
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importId, setImportId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const { data: progress } = usePhoneImport(importId);

  async function runPreview() {
    if (!file) return;
    setError(null);
    setPreviewing(true);
    try {
      setPreview(await previewPhoneImport(file, DEFAULT_COUNTRY));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      setPreviewing(false);
    }
  }

  async function runImport() {
    if (!preview) return;
    setError(null);
    try {
      const record = await confirm.mutateAsync(preview.importId);
      setImportId(record.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the import.');
    }
  }

  async function downloadErrors() {
    if (!importId) return;
    const report = await getPhoneImportErrors(importId);
    const url = URL.createObjectURL(new Blob([report.csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = report.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const done = progress?.status === 'COMPLETED' || progress?.status === 'FAILED';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Import phones from Excel" className="max-h-[92vh] max-w-2xl overflow-y-auto">
      {!preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Choose your Excel file (.xlsx) with these four columns: <b>Name</b>, <b>Phone</b>, <b>Email</b>, <b>Company</b>. Only <b>Phone</b> is
            required — the rest are filled in when present, and everything else (call history, tags…) the platform adds itself. Numbers are
            normalised (0691234567 → +355691234567) and duplicates are found before anything is saved.
          </p>
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            data-testid="excel-template"
          >
            <Download className="h-4 w-4" /> Download the Excel template (Name, Phone, Email, Company)
          </button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="excel-file">Excel file</Label>
            <Input
              id="excel-file"
              type="file"
              accept={EXCEL_ACCEPT}
              data-testid="excel-file"
              onChange={(e) => {
                const chosen = e.target.files?.[0] ?? null;
                if (chosen && !isExcelFile(chosen)) {
                  setError('Please choose an Excel file (.xlsx or .xls).');
                  setFile(null);
                  e.target.value = '';
                  return;
                }
                setError(null);
                setFile(chosen);
              }}
            />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void runPreview()} disabled={!file || previewing}>
              {previewing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-4 w-4" />}
              {previewing ? 'Reading…' : 'Preview'}
            </Button>
          </div>
        </div>
      ) : !importId ? (
        <div className="flex flex-col gap-4" data-testid="import-preview">
          <div>
            <h3 className="text-sm font-semibold">Import preview — {preview.fileName}</h3>
            <p className="text-xs text-foreground/50">
              Phone column: <b>{preview.columns.phone}</b>
              {preview.columns.name ? ` · Name: ${preview.columns.name}` : ''}
              {preview.columns.email ? ` · Email: ${preview.columns.email}` : ''}
              {preview.columns.company ? ` · Company: ${preview.columns.company}` : ''}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-md bg-accent/40 p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-foreground/50">Total rows</dt>
              <dd className="font-semibold tabular-nums">{preview.totals.total.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">✓ Valid</dt>
              <dd className="font-semibold tabular-nums">{preview.totals.valid.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">⚠ Duplicates</dt>
              <dd className="font-semibold tabular-nums">{preview.totals.duplicates.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">✕ Invalid</dt>
              <dd className="font-semibold tabular-nums">{preview.totals.invalid.toLocaleString()}</dd>
            </div>
          </dl>
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-accent/60 text-left">
                <tr>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Phone</th>
                  <th className="px-2 py-1.5">Normalised</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.row} className="border-t border-border">
                    <td className="px-2 py-1">{r.name ?? '—'}</td>
                    <td className="px-2 py-1 tabular-nums">{r.phone}</td>
                    <td className="px-2 py-1 tabular-nums">{r.normalized ?? '—'}</td>
                    <td className="px-2 py-1">
                      <Badge variant={ROW_VARIANT[r.status]}>{r.statusLabel}</Badge>
                      {r.reason && r.status === 'invalid' ? <span className="ml-1 text-foreground/50">{r.reason}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.totals.total > preview.sample.length ? (
            <p className="text-xs text-foreground/50">Showing the first {preview.sample.length} of {preview.totals.total.toLocaleString()} rows.</p>
          ) : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void runImport()} disabled={preview.totals.valid === 0 || confirm.isPending}>
              Import {preview.totals.valid.toLocaleString()} phones
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="import-result">
          <h3 className="text-sm font-semibold">{done ? (progress?.status === 'COMPLETED' ? 'Import completed' : 'Import failed') : 'Importing…'}</h3>
          {progress ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.validRows ? Math.min(100, Math.round(((progress.importedRows + progress.skippedRows + progress.failedRows) / progress.validRows) * 100)) : 100}%` }}
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 rounded-md bg-accent/40 p-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-foreground/50">Total rows</dt>
                  <dd className="font-semibold tabular-nums">{progress.totalRows.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground/50">✓ Imported</dt>
                  <dd className="font-semibold tabular-nums">{progress.importedRows.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground/50">⚠ Duplicates</dt>
                  <dd className="font-semibold tabular-nums">{progress.duplicateRows.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground/50">✕ Invalid</dt>
                  <dd className="font-semibold tabular-nums">{progress.invalidRows.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground/50">⚠ Skipped</dt>
                  <dd className="font-semibold tabular-nums">{progress.skippedRows.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-foreground/50">✕ Failed</dt>
                  <dd className="font-semibold tabular-nums">{progress.failedRows.toLocaleString()}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-foreground/50">Starting…</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {done && progress && progress.duplicateRows + progress.invalidRows + progress.failedRows > 0 ? (
              <Button type="button" variant="outline" onClick={() => void downloadErrors()}>
                <Download className="mr-1.5 h-4 w-4" /> Download error report
              </Button>
            ) : null}
            <Button type="button" onClick={onImported} disabled={!done}>
              View phones
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
