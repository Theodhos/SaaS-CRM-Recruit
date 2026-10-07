import { HttpStatus } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { COMPANY_PIPELINE_STAGES } from '../dto/create-company.dto';

export type CompanyStage = (typeof COMPANY_PIPELINE_STAGES)[number];

export interface CompanyStageRecord {
  /** What was written while the company was in this stage. */
  notes: string;
  /** When that text was last changed. */
  updatedAt: string | null;
  /** When the company (last) entered the stage. */
  enteredAt: string | null;
}

export interface CompanyPay {
  hourlyRate: number | null;
  hoursPerDay: number;
  daysPerMonth: number;
  feePercent: number | null;
  currency: string;
}

/**
 * Everything the Pipeline Companies pop-up keeps for a company (the `pipelineRecord` JSON column): the History text
 * of each stage with its dates, and the pay calculation. The company's stage itself stays in `pipelineStage`.
 */
export interface CompanyPipelineRecord {
  stages: Partial<Record<CompanyStage, CompanyStageRecord>>;
  pay: CompanyPay | null;
}

const MAX_NOTES = 5000;
const isStage = (value: string): value is CompanyStage => (COMPANY_PIPELINE_STAGES as readonly string[]).includes(value);
const text = (value: unknown) => (typeof value === 'string' ? value : null);
const invalid = (message: string) => new AppException('INVALID_PIPELINE_RECORD', message, HttpStatus.BAD_REQUEST);

/** The stored JSON as a record — anything missing or malformed reads as empty. */
export function readPipelineRecord(value: unknown): CompanyPipelineRecord {
  const raw = (value && typeof value === 'object' ? value : {}) as { stages?: unknown; pay?: unknown };
  const stages: CompanyPipelineRecord['stages'] = {};
  for (const [key, entry] of Object.entries(raw.stages && typeof raw.stages === 'object' ? raw.stages : {})) {
    if (!isStage(key) || !entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    stages[key] = { notes: text(e.notes) ?? '', updatedAt: text(e.updatedAt), enteredAt: text(e.enteredAt) };
  }
  return { stages, pay: raw.pay && typeof raw.pay === 'object' ? (raw.pay as CompanyPay) : null };
}

/** The record after the company moved from one stage to another: both get their entry date. */
export function withStageEntered(record: CompanyPipelineRecord, from: CompanyStage, to: CompanyStage, startedAt: Date, now: Date): CompanyPipelineRecord {
  const blank = { notes: '', updatedAt: null, enteredAt: null };
  const before = record.stages[from] ?? blank;
  return {
    ...record,
    stages: {
      ...record.stages,
      // where it was before its first recorded move: there since the company was added
      [from]: { ...before, enteredAt: before.enteredAt ?? startedAt.toISOString() },
      [to]: { ...(record.stages[to] ?? blank), enteredAt: now.toISOString() },
    },
  };
}

function number(value: unknown, name: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw invalid(`${name} must be a number between ${min} and ${max}`);
  return n;
}

/** The record with what the pop-up sent merged in; only the stages and the parts that were sent change. */
export function mergePipelineRecord(
  record: CompanyPipelineRecord,
  input: { stages?: Record<string, { notes?: unknown }>; pay?: Record<string, unknown> },
  now: Date,
): CompanyPipelineRecord {
  const stages = { ...record.stages };
  for (const [key, entry] of Object.entries(input.stages ?? {})) {
    if (!isStage(key)) throw invalid(`"${key}" is not a stage of the companies pipeline`);
    const notes = text(entry?.notes);
    if (notes === null) throw invalid(`The notes of ${key} must be text`);
    if (notes.length > MAX_NOTES) throw invalid(`The notes of ${key} are longer than ${MAX_NOTES} characters`);
    const before = stages[key] ?? { notes: '', updatedAt: null, enteredAt: null };
    if (notes.trim() !== before.notes.trim()) stages[key] = { ...before, notes: notes.trim(), updatedAt: now.toISOString() };
  }

  let pay = record.pay;
  if (input.pay) {
    const currency = text(input.pay.currency) ?? 'USD';
    if (!/^[A-Z]{3}$/.test(currency)) throw invalid('currency must be a 3-letter code');
    pay = {
      hourlyRate: number(input.pay.hourlyRate, 'hourlyRate', 0, 100000),
      hoursPerDay: number(input.pay.hoursPerDay, 'hoursPerDay', 1, 24) ?? 8,
      daysPerMonth: number(input.pay.daysPerMonth, 'daysPerMonth', 1, 31) ?? 21,
      feePercent: number(input.pay.feePercent, 'feePercent', 0, 100),
      currency,
    };
  }
  return { stages, pay };
}
