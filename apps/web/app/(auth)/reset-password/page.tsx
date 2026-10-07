'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@crm/ui';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ApiClientError } from '@/lib/api-client';
import { logout, resetPassword } from '@/services/auth.service';

// `useSearchParams()` must sit under a Suspense boundary so the route can be statically prerendered.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

/** Where the link from the password reset e-mail lands: choose the new password. */
function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const differs = confirm.length > 0 && confirm !== password;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await resetPassword(token, password);
      // whoever was signed in on this browser signs in again, with the new password
      await logout().catch(() => undefined);
      router.replace(`/login?notice=${encodeURIComponent('Your password was changed. Sign in with the new one.')}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
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
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-foreground/60">
              This page opens from the link in the password reset e-mail.{' '}
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                Request a link
              </Link>
            </p>
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
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                {tooShort ? <p className="text-xs text-destructive">Password must be at least 8 characters</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {differs ? <p className="text-xs text-destructive">The two passwords are not the same</p> : null}
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="mt-2" disabled={saving || password.length < 8 || confirm !== password}>
                {saving ? 'Saving…' : 'Reset password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-foreground/60">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
