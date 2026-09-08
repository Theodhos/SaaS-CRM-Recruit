'use client';

import type { ReactNode } from 'react';

import { QueryProvider } from './query-provider';

/**
 * Single composition root for client-side providers. Add auth/session and
 * realtime-socket providers here as they're implemented (Phase 2) rather
 * than nesting them ad hoc in individual layouts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
