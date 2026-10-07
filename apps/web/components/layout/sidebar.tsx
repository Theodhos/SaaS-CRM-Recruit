'use client';

import { cn } from '@crm/ui';
import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SidebarNav } from '@/components/navigation';

/**
 * One icon per category by default, so the page gets the width; the bars button opens it to the full menu with the
 * category names and their pages, and closes it again. A click on a category icon opens it too, pointing at that
 * category's first page. Going to another page closes it.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // the category whose icon opened the menu
  const [pointAt, setPointAt] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setPointAt(null);
  }, [pathname]);

  function close() {
    setOpen(false);
    setPointAt(null);
  }

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 md:flex',
        open ? 'w-64' : 'w-14',
      )}
      data-testid="sidebar"
      data-state={open ? 'open' : 'closed'}
    >
      <div className={cn('flex h-14 items-center gap-2 border-b border-border', open ? 'px-3' : 'justify-center')}>
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground/60 hover:bg-accent"
          aria-label={open ? 'Collapse navigation' : 'Expand navigation'}
          aria-expanded={open}
          title={open ? 'Collapse menu' : 'Expand menu'}
        >
          <Menu className="h-5 w-5" />
        </button>
        {open ? <span className="truncate text-sm font-semibold">Recruitment CRM</span> : null}
      </div>
      {/* a click on the page already open does not change the path, so the links close the menu themselves as well */}
      <div className="flex min-h-0 flex-1 flex-col" onClick={(e) => (e.target as HTMLElement).closest('a') && close()}>
        <SidebarNav
          collapsed={!open}
          pointAt={pointAt}
          onExpand={(category) => {
            setPointAt(category);
            setOpen(true);
          }}
        />
      </div>
    </aside>
  );
}
