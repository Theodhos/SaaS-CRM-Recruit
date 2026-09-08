'use client';

import { Bell, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { NAV_GROUPS } from '@/components/navigation';

function currentPageLabel(pathname: string | null): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname?.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  return 'Recruitment CRM';
}

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <h1 className="text-sm font-semibold text-foreground">{currentPageLabel(pathname)}</h1>

      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="relative hidden max-w-xs flex-1 sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="search"
            placeholder="Search..."
            disabled
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-foreground/40 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <button
          type="button"
          disabled
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground/60 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          RC
        </div>
      </div>
    </header>
  );
}
