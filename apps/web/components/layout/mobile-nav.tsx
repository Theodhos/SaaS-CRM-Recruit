'use client';

import { Briefcase, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SidebarNav } from '@/components/navigation';

/**
 * Below `md` the Sidebar is `hidden` (see sidebar.tsx) — this is the only
 * way to reach any other page on a phone/narrow tablet. A slide-in overlay
 * reusing the same SidebarNav, not a second nav to keep in sync.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-accent md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Briefcase className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold">Recruitment CRM</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-accent"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div onClick={() => setOpen(false)}>
              <SidebarNav />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
