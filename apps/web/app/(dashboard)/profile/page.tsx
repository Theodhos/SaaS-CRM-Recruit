'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { initials } from '@crm/utils';
import { Building2, KeyRound, Mail, UserCircle } from 'lucide-react';
import { useState } from 'react';

import { isAdminSession } from '@/components/navigation';
import { UsersDirectory } from '@/features/users';
import { useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { roleColour } from '@/lib/status-colors';
import { requestMyPasswordReset, type PasswordResetRequest } from '@/services/auth.service';

/**
 * The signed-in person's own account: who they are and their role (the badge next to the name). For the admin it is
 * also where the organisation's users are: every account, "Add Instructor", edit, password and deactivate
 * (UsersDirectory). Members see their own account only.
 */
export default function ProfilePage() {
  const { data: session, isLoading } = useSession();
  const [reset, setReset] = useState<PasswordResetRequest | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function sendReset() {
    setResetting(true);
    setResetError(null);
    try {
      setReset(await requestMyPasswordReset());
    } catch (e) {
      setResetError(e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  if (isLoading || !session) {
    return <p className="text-sm text-foreground/60">Loading…</p>;
  }
  const isAdmin = isAdminSession(session);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(session.firstName, session.lastName)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {session.firstName} {session.lastName}
            </h2>
            <Badge variant={roleColour(session.role.name)}>{session.role.name}</Badge>
          </div>
          <p className="mt-1 text-sm text-foreground/60">
            {isAdmin
              ? 'Your admin account. You see everything in the organisation and manage its users below.'
              : 'Your instructor account. You see and manage the candidates, companies and jobs you add yourself.'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="h-4 w-4 text-foreground/50" /> Personal details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-foreground/50">First name</dt>
              <dd className="text-sm">{session.firstName}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Last name</dt>
              <dd className="text-sm">{session.lastName}</dd>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
              <div>
                <dt className="text-xs text-foreground/50">Email</dt>
                <dd className="text-sm">{session.email}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
              <div>
                <dt className="text-xs text-foreground/50">Status</dt>
                <dd className="text-sm">{session.status}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card data-testid="profile-password">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-foreground/50" /> Password
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground/60">
            Forgot it, or want a new one? We e-mail a link to {session.email} where you choose a new password. The link works once and expires in
            30 minutes.
          </p>
          {reset ? (
            <p className="text-sm" role="status">
              The link is on its way to {session.email}.
              {reset.devLink ? (
                <span className="mt-2 block rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-950">
                  E-mail is not set up on this server, so nothing was sent. Development link:{' '}
                  <a href={reset.devLink} className="break-all font-medium underline" data-testid="dev-reset-link">
                    {reset.devLink}
                  </a>
                </span>
              ) : null}
            </p>
          ) : null}
          {resetError ? <p className="text-sm text-destructive">{resetError}</p> : null}
          <div>
            <Button type="button" disabled={resetting} onClick={() => void sendReset()}>
              {resetting ? 'Sending…' : reset ? 'Send the link again' : 'Send password reset e-mail'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <section className="flex flex-col gap-4 border-t border-border pt-6" data-testid="profile-users">
          <UsersDirectory />
        </section>
      ) : null}
    </div>
  );
}
