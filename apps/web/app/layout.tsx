import type { Metadata } from 'next';

import { AppProviders } from '@/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Recruitment CRM',
  description: 'Recruitment CRM + ATS platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
