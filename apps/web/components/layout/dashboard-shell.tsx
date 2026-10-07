'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { ADMIN_ONLY_PATHS, isAdminSession, isSectionAllowed, navHrefOf, visibleNavGroups } from '@/components/navigation';
import { useSession } from '@/hooks/use-session';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = isAdminSession(session);

  // Admin-only pages, and for a member the pages the admin did not give them: whoever types the address is sent to
  // the first page they do have. (The API refuses admin data anyway — this avoids an empty, erroring page.)
  const adminPage = ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname?.startsWith(`${p}/`));
  const section = navHrefOf(pathname);
  const notGiven = section !== null && !isSectionAllowed(section, session?.allowedSections);
  const blocked = session !== undefined && session !== null && !isAdmin && (adminPage || notGiven);
  const home = visibleNavGroups(isAdmin, session?.allowedSections)[0]?.items[0]?.href ?? '/profile';
  useEffect(() => {
    if (blocked && home !== pathname) router.replace(home);
  }, [blocked, home, pathname, router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-x-hidden bg-accent/30 p-4 sm:p-6">{blocked ? null : children}</main>
      </div>
    </div>
  );
}
