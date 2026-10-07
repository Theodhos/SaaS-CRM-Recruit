'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@crm/ui';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ApiClientError } from '@/lib/api-client';
import { requestPasswordReset } from '@/services/auth.service';

/**
 * "Forgot your password?" — a link to choose a new one is e-mailed. The page says the same whatever the address,
 * so it cannot be used to find out who has an account.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSending(true);
    setError(null);
    try {
      setSent(await requestPasswordReset(email.trim()));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Briefcase className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold">Recruitment CRM</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We&apos;ll email you a link to choose a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-3" data-testid="reset-requested">
              <p className="text-sm">If this address has an account, a link to choose a new password is on its way. It works once and expires in 30 minutes.</p>
              {sent.devLink ? (
                <p className="rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-950">
                  E-mail is not set up on this server, so nothing was sent. Development link:{' '}
                  <a href={sent.devLink} className="break-all font-medium underline" data-testid="dev-reset-link">
                    {sent.devLink}
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="mt-2" disabled={sending || !/^\S+@\S+\.\S+$/.test(email.trim())}>
                {sending ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-foreground/60">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
