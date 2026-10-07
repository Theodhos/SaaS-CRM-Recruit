import { AsyncLocalStorage } from 'node:async_hooks';

import type { NextFunction, Request, Response } from 'express';

/**
 * Per-request state that data-access code needs but should not have to thread through every call:
 * `recordOwnerId` is set (by TenantGuard) when the current user may only see their OWN records. Unset = sees
 * everything in the organisation (admins, and work that runs outside a user request: crons, public endpoints).
 */
interface RequestContextStore {
  recordOwnerId?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Express middleware: opens a fresh context for every request (must run before the guards). */
export function requestContextMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  storage.run({}, next);
}

export function setRecordOwnerScope(userId: string | undefined): void {
  const store = storage.getStore();
  if (store) store.recordOwnerId = userId;
}

/** The user whose records the current request is limited to, or undefined when it may see the whole organisation. */
export function getRecordOwnerScope(): string | undefined {
  return storage.getStore()?.recordOwnerId;
}

/** Holders of this permission are organisation admins: they see and manage every record. */
export const SEES_ALL_RECORDS_PERMISSION = 'users:manage';
