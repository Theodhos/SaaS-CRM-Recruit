import type { Prisma } from '@crm/database';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { UpsertStageNoteDto } from '../dto/stage-note.dto';

const STAGE_SELECT = { id: true, name: true, order: true, type: true } as const;

const FIELD_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/;
const MAX_FIELDS = 60;
const MAX_FIELD_TEXT = 2000;

/**
 * The stage form is free-form JSON from the web app, so it is checked here rather than trusted: at most 60 keys,
 * identifier-like names, primitive values only (text up to 2000 characters, finite numbers, booleans, null).
 */
function sanitizeFields(input: Record<string, unknown>): Prisma.InputJsonObject {
  const entries = Object.entries(input);
  if (entries.length > MAX_FIELDS) throw new AppException('INVALID_STAGE_FIELDS', `At most ${MAX_FIELDS} fields per stage`, HttpStatus.BAD_REQUEST);
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of entries) {
    if (!FIELD_KEY.test(key)) throw new AppException('INVALID_STAGE_FIELDS', `"${key}" is not a valid field name`, HttpStatus.BAD_REQUEST);
    if (value === null || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string') {
      if (value.length > MAX_FIELD_TEXT) throw new AppException('INVALID_STAGE_FIELDS', `"${key}" is longer than ${MAX_FIELD_TEXT} characters`, HttpStatus.BAD_REQUEST);
      out[key] = value;
    } else throw new AppException('INVALID_STAGE_FIELDS', `"${key}" must be text, a number, true/false or empty`, HttpStatus.BAD_REQUEST);
  }
  return out;
}

const stageIdOf = (values: unknown): string | null => {
  const id = values && typeof values === 'object' ? (values as { pipelineStageId?: unknown }).pipelineStageId : null;
  return typeof id === 'string' ? id : null;
};

/**
 * When the applicant entered each stage they have been in — the latest time, for a stage they came back to, so the
 * dates follow the order of the journey. Read from the application's audit trail (oldest first): every move is an
 * UPDATE_APPLICATION whose old and new values carry the stage, and CREATE_/REOPEN_APPLICATION name the stage they
 * were put in. The stage they started in dates from the application itself.
 */
export function stageEntries(
  logs: { action: string; oldValues: unknown; newValues: unknown; createdAt: Date }[],
  startedAt: Date,
): Map<string, Date> {
  const entered = new Map<string, Date>();
  let current: string | null = null;
  for (const log of logs) {
    // where they were before the first recorded move: that is where they started
    const from = log.action === 'UPDATE_APPLICATION' ? stageIdOf(log.oldValues) : null;
    if (from && entered.size === 0) entered.set(from, startedAt);
    current = current ?? from;
    const to = stageIdOf(log.newValues);
    if (to && to !== current) {
      entered.set(to, entered.size === 0 ? startedAt : log.createdAt);
      current = to;
    }
  }
  return entered;
}

export interface StageMove {
  at: Date;
  /** added to the pipeline · moved to another stage · brought back after a rejection · taken off the board · put back on it */
  kind: 'added' | 'moved' | 'reopened' | 'removed' | 'restored';
  fromStageId: string | null;
  toStageId: string | null;
  /** Who did it — null when nobody was signed in (a website application). */
  by: string | null;
}

/**
 * Everything that happened to the application's place on the board, in order, read from its audit trail (oldest
 * first): unlike `stageEntries` nothing is merged — a stage visited three times is three moves.
 */
export function stageMoves(
  logs: { action: string; oldValues: unknown; newValues: unknown; createdAt: Date; user?: { firstName: string; lastName: string } | null }[],
): StageMove[] {
  const moves: StageMove[] = [];
  let current: string | null = null;
  for (const log of logs) {
    const by = log.user ? `${log.user.firstName} ${log.user.lastName}` : null;
    const to = stageIdOf(log.newValues);
    if (log.action === 'CREATE_APPLICATION') {
      moves.push({ at: log.createdAt, kind: 'added', fromStageId: null, toStageId: to, by });
      current = to ?? current;
    } else if (log.action === 'REOPEN_APPLICATION') {
      moves.push({ at: log.createdAt, kind: 'reopened', fromStageId: current, toStageId: to, by });
      current = to ?? current;
    } else if (log.action === 'UPDATE_APPLICATION') {
      const from: string | null = stageIdOf(log.oldValues) ?? current;
      current = current ?? from;
      if (to && to !== from) {
        moves.push({ at: log.createdAt, kind: 'moved', fromStageId: from, toStageId: to, by });
        current = to;
      }
    } else if (log.action === 'DELETE_APPLICATION') {
      moves.push({ at: log.createdAt, kind: 'removed', fromStageId: current, toStageId: null, by });
    } else if (log.action === 'RESTORE_APPLICATION') {
      moves.push({ at: log.createdAt, kind: 'restored', fromStageId: null, toStageId: current, by });
    }
  }
  return moves;
}

/** Money maths done once, here, so every screen shows the same figures. */
export function payBreakdown(note: { hourlyRate: unknown; hoursPerDay: number; daysPerMonth: number; feePercent: unknown }) {
  const rate = note.hourlyRate === null || note.hourlyRate === undefined ? null : Number(note.hourlyRate);
  const fee = note.feePercent === null || note.feePercent === undefined ? null : Number(note.feePercent);
  if (rate === null) return { perDay: null, perMonth: null, feePerMonth: null };
  const perDay = +(rate * note.hoursPerDay).toFixed(2);
  const perMonth = +(perDay * note.daysPerMonth).toFixed(2);
  const feePerMonth = fee === null ? null : +((perMonth * fee) / 100).toFixed(2);
  return { perDay, perMonth, feePerMonth };
}

/**
 * Per-stage notes and pay calculation for an applicant. Tenant AND owner scoping come from `forTenant`: an instructor
 * can only read or write notes on applications whose candidate they own; the admin sees all.
 */
@Injectable()
export class StageNotesService {
  constructor(private readonly db: DatabaseService) {}

  /** Every stage of the applicant's pipeline, in order, with the note recorded there (if any). */
  async listForApplication(organisationId: string, applicationId: string) {
    const db = this.db.forTenant(organisationId);
    const application = await db.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true, pipelineId: true, pipelineStageId: true, createdAt: true, updatedAt: true, pipeline: { select: { stages: { select: STAGE_SELECT, orderBy: { order: 'asc' } } } } },
    });
    if (!application) throw new ResourceNotFoundException('Application', applicationId);

    const [notes, trail] = await Promise.all([
      db.applicationStageNote.findMany({ where: { applicationId } }),
      db.auditLog.findMany({
        where: { organisationId, entityType: 'Application', entityId: applicationId, action: { in: ['CREATE_APPLICATION', 'UPDATE_APPLICATION', 'REOPEN_APPLICATION', 'DELETE_APPLICATION', 'RESTORE_APPLICATION'] } },
        select: { action: true, oldValues: true, newValues: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const byStage = new Map(notes.map((n) => [n.pipelineStageId, n]));
    const entered = stageEntries(trail, application.createdAt);
    // no trail for the stage they are in (an application older than the audit log): they are there all the same
    if (!entered.has(application.pipelineStageId)) {
      entered.set(application.pipelineStageId, entered.size === 0 ? application.createdAt : application.updatedAt);
    }
    return {
      applicationId,
      currentStageId: application.pipelineStageId,
      /** When the application was made — where its story starts when the audit trail is younger than it. */
      startedAt: application.createdAt,
      /** Every move on the board, oldest first (the candidate's History lists them all). */
      moves: stageMoves(trail),
      stages: application.pipeline.stages.map((stage) => {
        const note = byStage.get(stage.id);
        // enteredAt: when the applicant (last) entered this stage — null for a stage they have never been in
        return { stage, note: note ? this.present(note) : null, enteredAt: entered.get(stage.id) ?? null };
      }),
    };
  }

  async upsert(organisationId: string, applicationId: string, stageId: string, dto: UpsertStageNoteDto) {
    const db = this.db.forTenant(organisationId);
    const application = await db.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true, pipelineId: true },
    });
    if (!application) throw new ResourceNotFoundException('Application', applicationId);
    // The stage must belong to the applicant's own pipeline (pipeline stages carry no organisationId of their own).
    const stage = await db.pipelineStage.findFirst({ where: { id: stageId, pipelineId: application.pipelineId }, select: { id: true } });
    if (!stage) throw new ResourceNotFoundException('Pipeline stage', stageId);

    const data = {
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.hourlyRate !== undefined ? { hourlyRate: dto.hourlyRate } : {}),
      ...(dto.hoursPerDay !== undefined ? { hoursPerDay: dto.hoursPerDay } : {}),
      ...(dto.daysPerMonth !== undefined ? { daysPerMonth: dto.daysPerMonth } : {}),
      ...(dto.feePercent !== undefined ? { feePercent: dto.feePercent } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.fields !== undefined ? { fields: sanitizeFields(dto.fields) } : {}),
    };
    const note = await db.applicationStageNote.upsert({
      where: { applicationId_pipelineStageId: { applicationId, pipelineStageId: stageId } },
      create: { applicationId, pipelineStageId: stageId, organisationId, ...data },
      update: data,
    });
    return this.present(note);
  }

  private present(note: {
    id: string; pipelineStageId: string; notes: string | null; hourlyRate: unknown; hoursPerDay: number; daysPerMonth: number;
    feePercent: unknown; currency: string; fields: unknown; createdAt: Date; updatedAt: Date;
  }) {
    return {
      id: note.id,
      pipelineStageId: note.pipelineStageId,
      notes: note.notes,
      fields: (note.fields && typeof note.fields === 'object' ? note.fields : {}) as Record<string, string | number | boolean | null>,
      hourlyRate: note.hourlyRate === null ? null : Number(note.hourlyRate),
      hoursPerDay: note.hoursPerDay,
      daysPerMonth: note.daysPerMonth,
      feePercent: note.feePercent === null ? null : Number(note.feePercent),
      currency: note.currency,
      ...payBreakdown(note),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
