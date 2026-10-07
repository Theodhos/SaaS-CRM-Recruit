import type { Notification, OffsetPaginatedResult } from '@crm/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { notificationCandidateId, notificationTarget } from '@/lib/notification-target';
import { getCandidate } from '@/services/candidates.service';
import {
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ListNotificationsParams,
} from '@/services/notifications.service';

const key = {
  all: ['notifications'] as const,
  list: (params: ListNotificationsParams) => ['notifications', 'list', params] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

export function useNotifications(params: ListNotificationsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listNotifications(params) });
}

/** Polled, not pushed — there's no websocket/SSE channel in this app yet, so the bell badge refreshes every 30s. */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: key.unreadCount,
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    // read the moment it is clicked: the lists and the bell's count change before the server has answered
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: key.all });
      let wasUnread = false;
      queryClient.setQueriesData<OffsetPaginatedResult<Notification>>({ queryKey: ['notifications', 'list'] }, (list) =>
        list?.items
          ? {
              ...list,
              items: list.items.map((n) => {
                if (n.id !== id || n.readAt) return n;
                wasUnread = true;
                return { ...n, readAt: new Date().toISOString() as unknown as Notification['readAt'] };
              }),
            }
          : list,
      );
      if (wasUnread) {
        queryClient.setQueryData<{ count: number }>(key.unreadCount, (unread) => (unread ? { count: Math.max(0, unread.count - 1) } : unread));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

/**
 * Opening a notification, done the fast way. `warm` (on hover / when the list shows) gets the target ready before
 * the click: the page's code and, for a candidate, their data. `open` marks it read at once and goes straight to
 * the exact place it is about (see lib/notification-target.ts) — it never waits for the "read" request.
 */
export function useOpenNotification() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const markRead = useMarkNotificationRead();

  function warm(notification: Notification) {
    const target = notificationTarget(notification);
    if (!target) return;
    router.prefetch(target);
    const candidateId = notificationCandidateId(notification);
    if (candidateId) {
      void queryClient.prefetchQuery({ queryKey: ['candidates', 'detail', candidateId], queryFn: () => getCandidate(candidateId), staleTime: 30_000 });
    }
  }

  function open(notification: Notification) {
    const target = notificationTarget(notification);
    if (target) router.push(target);
    if (!notification.readAt) markRead.mutate(notification.id);
  }

  return { warm, open, canOpen: (notification: Notification) => notificationTarget(notification) !== null };
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
