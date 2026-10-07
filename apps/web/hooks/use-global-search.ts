import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { globalSearch } from '@/services/search.service';

/** Debounces keystrokes by 250ms before hitting /search — the header box searches as you type, not on every keystroke. */
export function useGlobalSearch(rawQuery: string) {
  const [debounced, setDebounced] = useState(rawQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(rawQuery), 250);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const q = debounced.trim();

  return useQuery({
    queryKey: ['search', 'global', q],
    queryFn: () => globalSearch(q),
    enabled: q.length > 0,
  });
}
