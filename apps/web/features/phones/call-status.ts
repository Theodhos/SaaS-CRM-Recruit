import { CALL_STATUS_COLOUR } from '@/lib/status-colors';
import type { PhoneCallStatus } from '@/services/phones.service';

export const CALL_STATUS_LABEL: Record<PhoneCallStatus, string> = {
  INITIATED: 'Calling…',
  RINGING: 'Ringing',
  ANSWERED: 'Answered',
  NO_ANSWER: 'No answer',
  BUSY: 'Busy',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
  ENDED: 'Ended',
};

export const CALL_STATUS_VARIANT = CALL_STATUS_COLOUR;

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
