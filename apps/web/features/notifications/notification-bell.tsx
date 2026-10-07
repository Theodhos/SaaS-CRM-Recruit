'use client';

import type { Notification } from '@crm/types';
import { cn } from '@crm/ui';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  useMarkAllNotificationsRead,
  useNotifications,
  useOpenNotification,
  useUnreadNotificationCount,
} from '@/hooks/use-notifications';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread } = useUnreadNotificationCount();
  const { data } = useNotifications({ pageSize: 8 });
  const { warm, open: openNotification } = useOpenNotification();
  const markAllRead = useMarkAllNotificationsRead();

  // the list is on screen: get the first few targets ready, so the click that follows is instant
  useEffect(() => {
    if (open) data?.items.slice(0, 4).forEach(warm);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- warm is recreated every render; only opening matters
  }, [open, data]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(notification: Notification) {
    setOpen(false);
    openNotification(notification);
  }

  const count = unread?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground/60 hover:bg-accent"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!data || data.items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-foreground/50">You&apos;re all caught up.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.items.map((notification) => (
                  <li
                    key={notification.id}
                    onClick={() => handleSelect(notification)}
                    onMouseEnter={() => warm(notification)}
                    data-testid="bell-notification"
                    className={cn(
                      'cursor-pointer px-3 py-2.5 hover:bg-accent/50',
                      !notification.readAt ? 'bg-accent/20' : '',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.readAt ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {notification.message ? (
                          <p className="text-xs text-foreground/60">{notification.message}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-foreground/40">{timeAgo(notification.createdAt)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-3 py-2 text-center">
            <Link
              href="/notifications"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
