'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { initials } from '@crm/utils';
import { ArrowLeft, Briefcase, Building2, KeyRound, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { InstructorRecords, PasswordDialog } from '@/features/users';
import { useUpdateUser, useUser, useUsersWorkload } from '@/hooks/use-users';
import { generatePassword } from '@/lib/password';
import { USER_STATUS_COLOUR } from '@/lib/status-colors';
import type { UserWorkload } from '@/services/users.service';

const EMPTY: Omit<UserWorkload, 'userId'> = { companies: 0, jobs: 0, candidates: 0, activeEmployees: 0 };

const METRICS: { key: keyof typeof EMPTY; label: string; icon: typeof Users }[] = [
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'candidates', label: 'Candidates', icon: Users },
  { key: 'activeEmployees', label: 'Active employees', icon: Trophy },
];

/**
 * One instructor, for the admin: their account details, the CRM categories they were given, what they have built in
 * their own account (and nothing about anyone else), and a way to set (and see, once) a new password.
 */
export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: user, isLoading } = useUser(params.id);
  const { data: workloadRows } = useUsersWorkload();
  const updateUser = useUpdateUser();
  const [shownPassword, setShownPassword] = useState<{ password: string } | null>(null);

  const workload = useMemo(() => new Map((workloadRows ?? []).map((w) => [w.userId, w])), [workloadRows]);
  const mine = (user && workload.get(user.id)) ?? EMPTY;

  async function handleResetPassword() {
    if (!user || !window.confirm(`Set a new password for ${user.firstName} ${user.lastName}? Their current password stops working.`)) return;
    const password = generatePassword();
    await updateUser.mutateAsync({ id: user.id, input: { password } });
    setShownPassword({ password });
  }

  if (isLoading || !user) {
    return <p className="text-sm text-foreground/60">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/profile" className="inline-flex w-fit items-center gap-1 text-sm text-foreground/60 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials(user.firstName, user.lastName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {user.firstName} {user.lastName}
              </h2>
              <Badge variant="success">{user.role.name}</Badge>
              <Badge variant={USER_STATUS_COLOUR[user.status]}>{user.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-foreground/60">{user.email}</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void handleResetPassword()}>
          <KeyRound className="mr-1.5 h-4 w-4" /> Set new password &amp; show
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map(({ key, label, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/60">{label}</CardTitle>
              <Icon className="h-4 w-4 text-foreground/40" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mine[key].toLocaleString()}</div>
              <p className="mt-0.5 text-xs text-foreground/50">added by {user.firstName}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <InstructorRecords user={user} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-foreground/50">Email</dt>
              <dd className="text-sm">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Role</dt>
              <dd className="text-sm">{user.role.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Status</dt>
              <dd className="text-sm">{user.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Password</dt>
              <dd className="text-sm text-foreground/60">Stored encrypted — set a new one to see it once.</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Account created</dt>
              <dd className="text-sm">{new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Sees</dt>
              <dd className="text-sm">Only the records they added themselves</dd>
            </div>
          </dl>
        </CardContent>
      </Card>


      {shownPassword ? (
        <PasswordDialog
          title="New password set"
          email={user.email}
          password={shownPassword.password}
          note="Their previous password no longer works"
          onClose={() => setShownPassword(null)}
        />
      ) : null}
    </div>
  );
}
