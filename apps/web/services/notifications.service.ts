import type { Notification, OffsetPaginatedResult } from '@crm/types';

import { apiClient } from '@/lib/api-client';

export interface ListNotificationsParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export function listNotifications(params: ListNotificationsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.unreadOnly) query.set('unreadOnly', 'true');

  return apiClient<OffsetPaginatedResult<Notification>>(`/notifications?${query.toString()}`);
}

export function getUnreadCount() {
  return apiClient<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiClient<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiClient<void>('/notifications/read-all', { method: 'POST' });
}

export function deleteNotification(id: string) {
  return apiClient<void>(`/notifications/${id}`, { method: 'DELETE' });
}
