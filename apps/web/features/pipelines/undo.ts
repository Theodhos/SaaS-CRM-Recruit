import { useSyncExternalStore } from 'react';

import { ApiClientError, apiClient } from '@/lib/api-client';
import { deleteApplication, getApplication, updateApplication } from '@/services/applications.service';
import { deletePlacement, listPlacements, updatePlacement } from '@/services/placements.service';
import { listStageNotes, upsertStageNote } from '@/services/stage-notes.service';

/**
 * Undo and Redo for the pipeline. Every action on a card — a move (dragged, "Move to", a stage button), hiring,
 * Completed, Terminated, On hold, Reconsider, removing the card, saving its History — first records what the card
 * looked like: the stage it was in, what every stage had written for it (notes, the stage's fields, pay) and, when
 * the action touches the Active Employees entry, that entry.
 *
 * Undo takes the latest record and puts all of it back — one press, one step back, latest first. While it does, it
 * notes what the card looked like before being put back: that is the record Redo uses to go one step forward again
 * (and going forward leaves a record for Undo, so the two can be pressed back and forth). A new action on a card
 * empties Redo, as in any editor. Both lists are kept on this device (localStorage), so they survive a reload.
 */

export interface NoteSnapshot {
  notes: string | null;
  fields: Record<string, string | number | boolean | null>;
  hourlyRate: number | null;
  hoursPerDay: number;
  daysPerMonth: number;
  feePercent: number | null;
  currency: string;
}

export interface PlacementSnapshot {
  candidateId: string;
  jobId: string;
  /** The Active Employees entry as it was; null when there was none (the action created it). */
  before: { id: string; status: string; endDate: string | null; employmentType: string | null } | null;
}

export interface UndoEntry {
  id: number;
  /** What was done, in words — shown as the buttons' tooltip. */
  label: string;
  applicationId: string;
  /**
   * What putting this record back means for the card itself: 'changed' = set it back as recorded; 'removed' = it was
   * taken off the board, so bring it back first; 'created' = it was put on the board, so take it off.
   */
  kind: 'changed' | 'removed' | 'created';
  /** The stage the card was in. */
  stageId: string;
  /** By stage id, for every stage of the pipeline: what was recorded there (null = nothing). */
  notes: Record<string, NoteSnapshot | null>;
  placement?: PlacementSnapshot;
  /** For a removed card: the card itself, so the board can show it again the moment the button is pressed. */
  card?: unknown;
  /**
   * Written from what the board showed, while the exact record is still being worked out by a step that is running
   * (see `stepHistory`). Enough to move the card on screen; replaced by the exact one, and never stored.
   */
  provisional?: boolean;
}

type EntryData = Omit<UndoEntry, 'id'>;
export type Direction = 'undo' | 'redo';

const LIMIT = 30;
const STORAGE_KEY = 'crm.pipeline.undo';
const NONE: UndoEntry[] = [];
const stacks: Record<Direction, UndoEntry[]> = { undo: NONE, redo: NONE };
/** The exact record a provisional entry is waiting for, by entry id. */
const pending = new Map<number, Promise<EntryData>>();
let nextId = 1;
let loaded = false;
const listeners = new Set<() => void>();

/** Reads what an earlier visit left behind — once, and only in the browser. */
function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    // (the first version stored the undo list alone, as an array)
    const { undo, redo } = Array.isArray(kept) ? { undo: kept, redo: [] } : (kept as { undo?: unknown; redo?: unknown });
    if (Array.isArray(undo)) stacks.undo = undo as UndoEntry[];
    if (Array.isArray(redo)) stacks.redo = redo as UndoEntry[];
    nextId = Math.max(0, ...[...stacks.undo, ...stacks.redo].map((entry) => entry.id)) + 1;
  } catch {
    /* storage blocked or unreadable: start with nothing to undo */
  }
}

function changed() {
  try {
    const exact = (list: UndoEntry[]) => list.filter((entry) => !entry.provisional);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ undo: exact(stacks.undo), redo: exact(stacks.redo) }));
  } catch {
    /* storage blocked: the records last until the page is reloaded */
  }
  listeners.forEach((listener) => listener());
}

const set = (direction: Direction, list: UndoEntry[]) => {
  stacks[direction] = list.slice(-LIMIT);
};

/** An action on a card records the card as it was. Doing something new ends the chance to redo. */
export function pushUndo(entry: EntryData) {
  load();
  set('undo', [...stacks.undo, { ...entry, id: nextId++ }]);
  set('redo', NONE);
  pending.clear();
  changed();
}

function useStack(direction: Direction): UndoEntry[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => {
      load();
      return stacks[direction];
    },
    () => NONE,
  );
}
/** The recorded actions, oldest first — the last one is what Undo reverses. */
export const useUndoStack = () => useStack('undo');
/** The undone actions, oldest first — the last one is what Redo does again. */
export const useRedoStack = () => useStack('redo');

const number = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? null : Number(value));

/** A stage record (from the applications list or from the stage-notes endpoint) as a snapshot. */
export function noteSnapshot(
  record:
    | {
        notes: string | null;
        fields: Record<string, string | number | boolean | null>;
        hourlyRate: string | number | null;
        hoursPerDay: number;
        daysPerMonth: number;
        feePercent: string | number | null;
        currency: string;
      }
    | null
    | undefined,
): NoteSnapshot | null {
  if (!record) return null;
  return {
    notes: record.notes,
    fields: { ...(record.fields ?? {}) },
    hourlyRate: number(record.hourlyRate),
    hoursPerDay: record.hoursPerDay,
    daysPerMonth: record.daysPerMonth,
    feePercent: number(record.feePercent),
    currency: record.currency,
  };
}

type PlacementLike = { id: string; status: string; endDate?: unknown; employmentType?: string | null };
const placementBefore = (placement: PlacementLike | undefined): PlacementSnapshot['before'] =>
  placement
    ? { id: placement.id, status: placement.status, endDate: placement.endDate ? String(placement.endDate) : null, employmentType: placement.employmentType ?? null }
    : null;

/** The Active Employees entry of this candidate for this job, as it is right now — read before an action changes it. */
export async function placementSnapshot(candidateId: string, jobId: string): Promise<PlacementSnapshot> {
  return { candidateId, jobId, before: placementBefore((await listPlacements({ candidateId, jobId, pageSize: 5 })).items[0]) };
}

const same = (a: NoteSnapshot | null, b: NoteSnapshot | null) => JSON.stringify(a) === JSON.stringify(b);
const EMPTY: NoteSnapshot = { notes: '', fields: {}, hourlyRate: null, hoursPerDay: 8, daysPerMonth: 21, feePercent: null, currency: 'USD' };
const isBlank = (note: NoteSnapshot | null) => !note || (!note.notes?.trim() && Object.keys(note.fields).length === 0 && note.hourlyRate === null);

/**
 * Puts back what the record holds, and returns the opposite record: the card as it was just before — what the
 * other button needs to take this step back again.
 */
async function restore(entry: UndoEntry): Promise<EntryData> {
  const opposite = { label: entry.label, applicationId: entry.applicationId };

  if (entry.kind === 'created') {
    // take the card off the board — remembering it whole, so the step can be reversed
    const [application, current] = await Promise.all([getApplication(entry.applicationId), listStageNotes(entry.applicationId)]);
    await deleteApplication(entry.applicationId);
    return {
      ...opposite,
      kind: 'removed',
      stageId: application.pipelineStageId,
      notes: Object.fromEntries(current.stages.map((s) => [s.stage.id, noteSnapshot(s.note)])),
      card: application,
    };
  }
  if (entry.kind === 'removed') await apiClient(`/applications/${entry.applicationId}/restore`, { method: 'POST' });

  // what there is now, read together; then everything that differs is written together
  const [application, current, placements] = await Promise.all([
    getApplication(entry.applicationId),
    listStageNotes(entry.applicationId),
    entry.placement ? listPlacements({ candidateId: entry.placement.candidateId, jobId: entry.placement.jobId, pageSize: 5 }) : null,
  ]);

  // back to the stage it was in — out of the hired stage before its entry is touched, into it before it is revived
  const stageAndPlacement = (async () => {
    if (application.pipelineStageId !== entry.stageId) await updateApplication(entry.applicationId, { pipelineStageId: entry.stageId });
    if (!entry.placement) return;
    const { candidateId, jobId, before } = entry.placement;
    // (moving into the hired stage creates the entry when there is none — so it is read again, after the move)
    const now = (await listPlacements({ candidateId, jobId, pageSize: 5 })).items;
    if (!before) {
      // the step being reversed hired them: the entry it created goes
      await Promise.all(now.map((placement) => deletePlacement(placement.id)));
    } else {
      // the entry as it was (a re-created one has a new id) — `endDate: null` clears the end date of an ended contract
      const target = now.find((placement) => placement.id === before.id) ?? now[0];
      if (target) {
        await updatePlacement(target.id, { status: before.status, endDate: before.endDate, employmentType: before.employmentType ?? undefined } as never);
      }
    }
  })();

  const notes = Object.entries(entry.notes).map(([stageId, wanted]) => {
    const now = noteSnapshot(current.stages.find((st) => st.stage.id === stageId)?.note);
    if (same(now, wanted) || (isBlank(now) && isBlank(wanted))) return null;
    const back = wanted ?? { ...EMPTY, hoursPerDay: now?.hoursPerDay ?? 8, daysPerMonth: now?.daysPerMonth ?? 21, currency: now?.currency ?? 'USD' };
    return upsertStageNote(entry.applicationId, stageId, { ...back, notes: back.notes ?? '' });
  });
  await Promise.all([stageAndPlacement, ...notes]);

  // the record brought a removed card back: the opposite step takes it off again
  if (entry.kind === 'removed') return { ...opposite, kind: 'created', stageId: entry.stageId, notes: {} };
  return {
    ...opposite,
    kind: 'changed',
    stageId: application.pipelineStageId,
    notes: Object.fromEntries(current.stages.map((s) => [s.stage.id, noteSnapshot(s.note)])),
    placement: entry.placement && placements ? { candidateId: entry.placement.candidateId, jobId: entry.placement.jobId, before: placementBefore(placements.items[0]) } : undefined,
  };
}

/** Thrown when the card a record belongs to no longer exists — such a record is dropped, not given back. */
export class UndoGoneError extends Error {}

/** Takes the latest record off a list — at once, so the button and the board can react before the server has done anything. */
export function takeStep(direction: Direction): UndoEntry | null {
  load();
  const entry = stacks[direction].at(-1) ?? null;
  if (entry) {
    set(direction, stacks[direction].slice(0, -1));
    changed();
  }
  return entry;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Carries out a step taken with `takeStep`: puts the record back on the server and files the opposite record on the
 * other list (Undo feeds Redo, Redo feeds Undo). The opposite record appears on the other list straight away —
 * provisionally, from what the board showed (`shown`) — so the other button works without waiting; it is replaced
 * by the exact one when the server has answered. Steps run one after the other, in the order the buttons were
 * pressed, so quick presses can never be applied out of order. If the step fails the record goes back where it was.
 */
export function stepHistory(direction: Direction, entry: UndoEntry, shown: Pick<UndoEntry, 'kind' | 'stageId' | 'card'>): Promise<void> {
  const other: Direction = direction === 'undo' ? 'redo' : 'undo';
  const placeholder: UndoEntry = { id: nextId++, label: entry.label, applicationId: entry.applicationId, notes: {}, ...shown, provisional: true };
  set(other, [...stacks[other], placeholder]);
  changed();

  // the record itself may still be provisional (the other button was pressed moments ago): the exact one is on its
  // way — picked up now, because by the time this step's turn comes that promise has been cleared away
  const awaited = pending.get(entry.id);
  const exact = queue.then(async () => restore(awaited ? { ...(await awaited), id: entry.id } : entry));
  pending.set(placeholder.id, exact);
  queue = exact.catch(() => undefined);

  return exact.then(
    (opposite) => {
      pending.delete(placeholder.id);
      set(other, stacks[other].map((item) => (item.id === placeholder.id ? { ...opposite, id: placeholder.id } : item)));
      changed();
    },
    (error: unknown) => {
      pending.delete(placeholder.id);
      set(other, stacks[other].filter((item) => item.id !== placeholder.id));
      const gone = error instanceof ApiClientError && error.status === 404;
      if (!gone) set(direction, [...stacks[direction], entry].sort((a, b) => a.id - b.id));
      changed();
      throw gone ? new UndoGoneError(`"${entry.label}" can no longer be ${direction === 'undo' ? 'undone' : 'redone'} — that card does not exist any more.`) : error;
    },
  );
}
