'use client';

import type { CompanyPipelineStage } from '@crm/types';
import { Badge, Button, Dialog, Input, Label, Select, Textarea, cn } from '@crm/ui';
import { ArrowDown, Calculator, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { COMPANY_STAGE_TONE, TONES } from '@/features/pipelines/stage-colors';
import { useSaveCompanyPipelineRecord, useUpdateCompany } from '@/hooks/use-companies';
import { useOrganisation } from '@/hooks/use-organisation';
import type { CompanyWithCounts } from '@/services/companies.service';

import { COMPANY_PIPELINE_STAGES } from './pipeline-stages';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ALL', 'CHF'] as const;
/** The stages a company is moved to with the buttons on top — New is only where it starts. */
const TARGETS: CompanyPipelineStage[] = ['IN_CONVERSATION', 'WIN', 'LOST'];

const labelOf = (stage: CompanyPipelineStage) =>
  COMPANY_PIPELINE_STAGES.find((s) => s.value === stage)?.label ?? stage;
const toneOf = (stage: CompanyPipelineStage) => TONES[COMPANY_STAGE_TONE[stage]];
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
const money = (value: number | null, currency: string) =>
  value === null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value);

/**
 * Opens from a card on Pipeline Companies — the companies' counterpart of the candidates' stage pop-up, with the
 * same logic: buttons on top move the company on (In conversation / Follow-up, Win, Lost); History shows the stages
 * it has been through as a chain with dates, what was written at the earlier ones (read until clicked, then
 * editable) and an input for the stage it is in now; and the pay calculation (rate per hour → day → month → fee).
 * Everything is kept in the company's `pipelineRecord`.
 */
export function CompanyStageDialog({
  company,
  onClose,
}: {
  company: CompanyWithCounts;
  onClose: () => void;
}) {
  const current = company.pipelineStage;
  const save = useSaveCompanyPipelineRecord();
  const updateCompany = useUpdateCompany();
  const { data: organisation } = useOrganisation();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [movingTo, setMovingTo] = useState<CompanyPipelineStage | null>(null);

  // the journey so far: every other stage the company has been in (or has text for), in the order it entered them
  const history = useMemo(() => {
    const stages = company.pipelineRecord?.stages ?? {};
    const passed = COMPANY_PIPELINE_STAGES.map((s) => s.value)
      .filter(
        (stage) => stage !== current && (stages[stage]?.enteredAt || stages[stage]?.notes?.trim()),
      )
      .map((stage) => ({
        stage,
        notes: stages[stage]?.notes?.trim() ?? '',
        at: stages[stage]?.enteredAt ?? stages[stage]?.updatedAt ?? null,
        writtenAt: stages[stage]?.updatedAt ?? null,
      }))
      .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
    return {
      path: [
        ...passed.map((p) => ({ stage: p.stage, at: p.at, current: false })),
        {
          stage: current,
          at: stages[current]?.enteredAt ?? String(company.createdAt),
          current: true,
        },
      ],
      earlier: passed.filter((p) => p.notes),
      own: stages[current]?.notes ?? '',
    };
  }, [company, current]);

  const [notes, setNotes] = useState(history.own);
  /** Earlier stages whose text was clicked to be changed, by stage — the text as it is being edited. */
  const [earlierEdits, setEarlierEdits] = useState<Partial<Record<CompanyPipelineStage, string>>>(
    {},
  );

  const savedPay = company.pipelineRecord?.pay ?? null;
  const defaults = organisation?.payDefaults;
  const [pay, setPay] = useState(() => ({
    hourlyRate:
      savedPay?.hourlyRate === null || savedPay?.hourlyRate === undefined
        ? ''
        : String(savedPay.hourlyRate),
    hoursPerDay: String(savedPay?.hoursPerDay ?? defaults?.hoursPerDay ?? 8),
    daysPerMonth: String(savedPay?.daysPerMonth ?? defaults?.daysPerMonth ?? 21),
    feePercent: savedPay
      ? savedPay.feePercent === null
        ? ''
        : String(savedPay.feePercent)
      : defaults?.feePercent === null || defaults?.feePercent === undefined
        ? ''
        : String(defaults.feePercent),
    currency: savedPay?.currency ?? defaults?.currency ?? 'USD',
  }));
  const setPayField =
    (field: keyof typeof pay) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setPay((p) => ({ ...p, [field]: event.target.value }));

  // live figures while typing: hour -> day -> month -> fee
  const rate = pay.hourlyRate.trim() === '' ? null : Number(pay.hourlyRate);
  const perDay =
    rate === null || Number.isNaN(rate)
      ? null
      : +(rate * (Number(pay.hoursPerDay) || 0)).toFixed(2);
  const perMonth = perDay === null ? null : +(perDay * (Number(pay.daysPerMonth) || 0)).toFixed(2);
  const fee = pay.feePercent.trim() === '' ? null : Number(pay.feePercent);
  const feePerMonth =
    perMonth === null || fee === null || Number.isNaN(fee)
      ? null
      : +((perMonth * fee) / 100).toFixed(2);

  async function saveAll() {
    setError(null);
    const stages: Record<string, { notes: string }> = { [current]: { notes } };
    for (const [stage, text] of Object.entries(earlierEdits)) stages[stage] = { notes: text ?? '' };
    await save.mutateAsync({
      id: company.id,
      input: {
        stages,
        pay: {
          hourlyRate: pay.hourlyRate.trim() === '' ? null : Number(pay.hourlyRate),
          hoursPerDay: Number(pay.hoursPerDay) || 8,
          daysPerMonth: Number(pay.daysPerMonth) || 21,
          feePercent: pay.feePercent.trim() === '' ? null : Number(pay.feePercent),
          currency: pay.currency,
        },
      },
    });
    setEarlierEdits({});
    setSavedAt(Date.now());
  }

  /** A button on top: what is typed is kept, then the company moves to that stage. */
  async function moveTo(stage: CompanyPipelineStage) {
    setMovingTo(stage);
    try {
      await saveAll();
      await updateCompany.mutateAsync({ id: company.id, input: { pipelineStage: stage } });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not move to ${labelOf(stage)}.`);
    } finally {
      setMovingTo(null);
    }
  }

  const busy = save.isPending || movingTo !== null;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={company.name}
      className="max-h-[92vh] max-w-3xl overflow-y-auto"
      footer={
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground/50">
            {savedAt ? 'Saved' : 'History and the pay calculation are saved together.'}
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={busy}
            onClick={() =>
              void saveAll().catch((e) =>
                setError(e instanceof Error ? e.message : 'Could not save.'),
              )
            }
            data-testid="company-save"
          >
            {save.isPending && movingTo === null ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="company-stage-dialog">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm" data-testid="company-stage-chip">
            <span className="text-foreground/60">Stage</span>
            <Badge variant={toneOf(current).badge}>{labelOf(current)}</Badge>
          </p>
          <Link
            href={`/companies/${company.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open company page
          </Link>
        </div>

        {/* the buttons that move the company on — each in the colour of the stage it leads to */}
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-accent/20 p-3"
          data-testid="company-stage-actions"
        >
          {TARGETS.filter((stage) => stage !== current).map((stage) => (
            <Button
              key={stage}
              type="button"
              className={toneOf(stage).button}
              disabled={busy}
              onClick={() => void moveTo(stage)}
            >
              {movingTo === stage ? 'Moving…' : labelOf(stage)}
            </Button>
          ))}
        </div>

        <section
          className="rounded-lg border border-border bg-background p-3 shadow-sm"
          data-testid="company-history"
        >
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <NotebookPen className="h-4 w-4 text-foreground/50" /> History
          </h4>
          {/* however long the journey gets, History keeps its height: the earlier stages scroll inside it */}
          <div className="max-h-72 overflow-y-auto pr-1">
            {history.earlier.length > 0 ? (
              <ol className="mb-1 flex flex-col" data-testid="company-history-earlier">
                {history.earlier.map((earlier) => {
                  const tone = toneOf(earlier.stage);
                  const heading = (
                    <span className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={tone.badge}>({labelOf(earlier.stage)})</Badge>
                      <span className="text-[11px] tabular-nums text-foreground/50">
                        {when(earlier.writtenAt ?? earlier.at)}
                      </span>
                    </span>
                  );
                  return (
                    <li key={earlier.stage} className="flex items-stretch gap-2">
                      {/* the timeline's rail, on the left: the stage's dot, a line, and the arrow down to the next stage */}
                      <span className="flex w-5 shrink-0 flex-col items-center pt-2.5" aria-hidden>
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', tone.solid)} />
                        <span className="w-px flex-1 bg-foreground/20" />
                        <ArrowDown className="h-4 w-4 shrink-0 text-foreground/50" />
                      </span>
                      <div className="min-w-0 flex-1 pb-2">
                        {earlier.stage in earlierEdits ? (
                          <div
                            className={cn(
                              'rounded-md border border-l-4 border-border bg-background px-2.5 py-2',
                              tone.edge,
                            )}
                          >
                            {heading}
                            <Textarea
                              aria-label={`History of ${labelOf(earlier.stage)}`}
                              rows={3}
                              className="min-h-0"
                              autoFocus
                              value={earlierEdits[earlier.stage] ?? ''}
                              onChange={(event) =>
                                setEarlierEdits((edits) => ({
                                  ...edits,
                                  [earlier.stage]: event.target.value,
                                }))
                              }
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Click to change this text"
                            className={cn(
                              'w-full rounded-md border border-l-4 border-border px-2.5 py-2 text-left text-sm hover:shadow-sm',
                              tone.soft,
                              tone.edge,
                            )}
                            data-testid="company-history-block"
                            onClick={() =>
                              setEarlierEdits((edits) => ({
                                ...edits,
                                [earlier.stage]: earlier.notes,
                              }))
                            }
                          >
                            {heading}
                            <span className="block whitespace-pre-wrap">{earlier.notes}</span>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
          <div className="flex items-stretch gap-2">
            <span className="flex w-5 shrink-0 flex-col items-center pt-2.5" aria-hidden>
              <span
                className={cn(
                  'h-3 w-3 shrink-0 rounded-full ring-2 ring-foreground/30 ring-offset-1',
                  toneOf(current).solid,
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="company-stage-notes"
                className="mb-1 mt-1 flex flex-wrap items-center gap-2"
              >
                <Badge variant={toneOf(current).badge}>({labelOf(current)})</Badge>
                <span className="text-[11px] font-normal tabular-nums text-foreground/50">
                  {when(history.path.at(-1)?.at)}
                </span>
              </Label>
              <Textarea
                id="company-stage-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write what matters about this company at this stage…"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border p-3" data-testid="company-pay">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Calculator className="h-4 w-4 text-foreground/50" /> Pay calculation
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="company-hourlyRate">Rate / hour</Label>
              <Input
                id="company-hourlyRate"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={pay.hourlyRate}
                onChange={setPayField('hourlyRate')}
                placeholder="e.g. 25"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="company-currency">Currency</Label>
              <Select id="company-currency" value={pay.currency} onChange={setPayField('currency')}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="company-hoursPerDay">Hours / day</Label>
              <Input
                id="company-hoursPerDay"
                type="number"
                min={1}
                max={24}
                value={pay.hoursPerDay}
                onChange={setPayField('hoursPerDay')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="company-daysPerMonth">Days / month</Label>
              <Input
                id="company-daysPerMonth"
                type="number"
                min={1}
                max={31}
                value={pay.daysPerMonth}
                onChange={setPayField('daysPerMonth')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="company-feePercent">Fee %</Label>
              <Input
                id="company-feePercent"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={pay.feePercent}
                onChange={setPayField('feePercent')}
                placeholder="e.g. 15"
              />
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 rounded-md bg-accent/40 p-3 text-sm">
            <div>
              <dt className="text-xs text-foreground/50">Per day ({pay.hoursPerDay || 0} h)</dt>
              <dd className="font-semibold tabular-nums" data-testid="company-per-day">
                {money(perDay, pay.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">
                Per month ({pay.daysPerMonth || 0} days)
              </dt>
              <dd className="font-semibold tabular-nums" data-testid="company-per-month">
                {money(perMonth, pay.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Agency fee / month</dt>
              <dd className="font-semibold tabular-nums">{money(feePerMonth, pay.currency)}</dd>
            </div>
          </dl>
        </section>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
