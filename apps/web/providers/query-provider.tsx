'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { ApiClientError } from '@/lib/api-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <ApiErrorBanner />
    </QueryClientProvider>
  );
}

/**
 * Any API error that nobody handled (a failed save, a rejected request) is shown here as a small dismissible banner
 * with the server's reason, instead of surfacing as an unhandled promise rejection (which, in development, is Next's
 * full-screen "Unhandled Runtime Error" overlay). Real network failures are reported the same way.
 */
function ApiErrorBanner() {
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      const reason: unknown = event.reason;
      if (reason instanceof ApiClientError) {
        event.preventDefault();
        setError({ message: reason.message, code: reason.code });
      } else if (reason instanceof TypeError && /fetch/i.test(reason.message)) {
        event.preventDefault();
        setError({ message: 'The server could not be reached. Please try again in a moment.', code: 'NETWORK' });
      }
    }
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  if (!error) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[100] flex max-w-lg -translate-x-1/2 items-start gap-3 rounded-md border border-destructive/40 bg-background px-4 py-3 text-sm shadow-lg"
    >
      <div className="min-w-0">
        <p className="font-medium text-destructive">This action could not be completed</p>
        <p className="mt-0.5 break-words text-foreground/70">{error.message}</p>
      </div>
      <button type="button" onClick={() => setError(null)} className="text-foreground/50 hover:text-foreground" aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
