import type { Metadata } from 'next';

import { WebVitalsReporter } from '@/components/shared/web-vitals-reporter';
import { AppProviders } from '@/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Recruitment CRM',
  description: 'Recruitment CRM + ATS platform',
};

// Origin of the API, so the browser can open the connection (DNS + TCP + TLS)
// while the page's JavaScript is still loading instead of on the first request.
// Omitted when the API URL is relative / same-origin.
function apiOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? '').origin;
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const origin = apiOrigin();
  return (
    <html lang="en">
      <head>{origin ? <link rel="preconnect" href={origin} crossOrigin="use-credentials" /> : null}</head>
      <body>
        <AppProviders>{children}</AppProviders>
        <WebVitalsReporter />
      </body>
    </html>
  );
}
