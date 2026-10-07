'use client';

import { initials } from '@crm/utils';
import { LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

import { NAV_GROUPS } from '@/components/navigation';
import { NotificationBell } from '@/features/notifications';
import { GlobalSearch } from '@/features/search';
import { useSession } from '@/hooks/use-session';
import { logout } from '@/services/auth.service';

import { MobileNav } from './mobile-nav';

function currentPageLabel(pathname: string | null): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname?.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  // a user's own page is opened from the users list on My Profile
  if (pathname?.startsWith('/users/')) return 'My Profile';
  return 'Recruitment CRM';
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-2 overflow-hidden">
        <MobileNav />
        <h1 className="truncate text-sm font-semibold text-foreground">{currentPageLabel(pathname)}</h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <GlobalSearch />

        <NotificationBell />

        {session ? (
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              title={`${session.firstName} ${session.lastName}`}
            >
              {initials(session.firstName, session.lastName)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/60 hover:bg-accent"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
