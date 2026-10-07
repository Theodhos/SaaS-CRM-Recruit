'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useGlobalSearch } from '@/hooks/use-global-search';
import type { SearchResultItem } from '@/services/search.service';

const GROUPS: { key: 'candidates' | 'contacts' | 'companies' | 'jobs'; label: string }[] = [
  { key: 'candidates', label: 'Candidates' },
  { key: 'contacts', label: 'People at companies' },
  { key: 'companies', label: 'Companies' },
  { key: 'jobs', label: 'Jobs' },
];

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasResults = data && GROUPS.some((g) => data[g.key].length > 0);

  return (
    <div ref={ref} className="relative hidden max-w-xs flex-1 sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
      <input
        type="search"
        placeholder="Search candidates, jobs, companies…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {open && query.trim().length > 0 ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-96 rounded-md border border-border bg-background shadow-lg">
          {isFetching && !data ? (
            <p className="px-3 py-6 text-center text-sm text-foreground/50">Searching…</p>
          ) : !hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-foreground/50">No matches for &quot;{query}&quot;.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {GROUPS.map((group) =>
                data && data[group.key].length > 0 ? (
                  <div key={group.key} className="py-1">
                    <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-foreground/40">
                      {group.label}
                    </p>
                    {data[group.key].map((item: SearchResultItem) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => {
                          setOpen(false);
                          setQuery('');
                        }}
                        className="flex flex-col px-3 py-1.5 text-sm hover:bg-accent/50"
                      >
                        <span className="font-medium">{item.label}</span>
                        {item.subtitle ? <span className="text-xs text-foreground/50">{item.subtitle}</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
