import { useEffect, useState } from 'react';

/**
 * False in the server-rendered HTML, true once React has attached its handlers. A form submitted before that is sent
 * by the browser itself (a page reload, nothing signed in), so submit buttons stay disabled until this is true.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
