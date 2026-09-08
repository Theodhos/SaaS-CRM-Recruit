/**
 * Canonical WebSocket event names emitted by this gateway. apps/api's
 * services publish to Redis (a pub/sub channel or BullMQ) after a mutation
 * commits; this app subscribes and re-emits to the relevant Socket.IO room
 * (`org:<organisationId>`, optionally `user:<userId>`). Kept centralized so
 * apps/web's socket client and this server never drift on event names.
 */
export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: 'notification.created',
  APPLICATION_STATUS_CHANGED: 'application.status_changed',
  TASK_UPDATED: 'task.updated',
  ACTIVITY_CREATED: 'activity.created',
  EMAIL_RECEIVED: 'email.received',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
