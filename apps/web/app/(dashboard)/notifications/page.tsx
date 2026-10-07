'use client';

import { Badge, Button } from '@crm/ui';
import { Bell, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useOpenNotification,
} from '@/hooks/use-notifications';
import { notificationColour } from '@/lib/status-colors';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useNotifications({ page, pageSize: 25, unreadOnly });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  // marks it read at once and goes to the exact place it is about; hovering a row gets that place ready
  const { warm, open: handleOpen } = useOpenNotification();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Placements, website applications, reminders and anything else on the platform that needs your attention.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={unreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setUnreadOnly((v) => !v);
              setPage(1);
            }}
          >
            {unreadOnly ? 'Showing unread' : 'Show unread only'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all read
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>
      ) : data && data.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Bell className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">
            {unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            You&apos;ll see placements, website applications, reminders and other platform events here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background">
          <ul className="flex flex-col divide-y divide-border">
            {data?.items.map((notification) => (
              <li
                key={notification.id}
                role={notification.link ? 'button' : undefined}
                tabIndex={notification.link ? 0 : undefined}
                onClick={() => handleOpen(notification)}
                onMouseEnter={() => warm(notification)}
                onFocus={() => warm(notification)}
                data-testid="notification-row"
                onKeyDown={(event) => {
                  if (notification.link && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    handleOpen(notification);
                  }
                }}
                className={`flex items-start justify-between gap-3 px-4 py-3 ${!notification.readAt ? 'bg-accent/20' : ''} ${notification.link ? 'cursor-pointer hover:bg-accent/40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {!notification.readAt ? (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  ) : null}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <Badge variant={notificationColour(notification.type)}>{notification.type.replaceAll('_', ' ')}</Badge>
                    </div>
                    {notification.message ? (
                      <p className="text-sm text-foreground/60">{notification.message}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-foreground/40">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!notification.readAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        markRead.mutate(notification.id);
                      }}
                    >
                      Mark read
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteNotification.mutate(notification.id);
                    }}
                    aria-label="Dismiss"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.totalItems > 0 ? (
        <div className="flex items-center justify-between text-sm text-foreground/60">
          <span>
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, data.totalItems)} of {data.totalItems}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {data.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
