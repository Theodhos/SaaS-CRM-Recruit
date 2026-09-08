import { Briefcase } from 'lucide-react';

import { SidebarNav } from '@/components/navigation';

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Briefcase className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Recruitment CRM</span>
      </div>
      <SidebarNav />
    </aside>
  );
}
