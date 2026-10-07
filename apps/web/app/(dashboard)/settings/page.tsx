'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '@crm/ui';
import { Building2, Calculator, KeyRound, Plug, ShieldCheck, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { isAdminSession } from '@/components/navigation';
import { CURRENCIES, formatDate } from '@/features/revenue';
import { useIntegrations, useOrganisation, useUpdateOrganisation } from '@/hooks/use-organisation';
import { useInvalidateSession, useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { changeMyPassword, updateMyAccount } from '@/services/auth.service';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);

function Section({ icon: Icon, title, description, testId, children }: { icon: typeof UserCircle; title: string; description: string; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-foreground/50" /> {title}
        </CardTitle>
        <p className="mt-0.5 text-xs text-foreground/50">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Feedback({ saved, error }: { saved: boolean; error: string | null }) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  return saved ? (
    <p className="text-sm text-emerald-700" role="status">
      Saved.
    </p>
  ) : null;
}

/** The signed-in user's own name. The e-mail is what they sign in with: the admin changes it, under My Profile. */
function AccountSection() {
  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setFirstName(session.firstName);
    setLastName(session.lastName);
  }, [session]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setError('First and last name are both needed.');
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateMyAccount({ firstName: firstName.trim(), lastName: lastName.trim() });
      await invalidateSession();
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, 'Could not save your account.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section icon={UserCircle} title="My account" description="Your own name, as the rest of the team sees it." testId="settings-account">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-first-name">First name</Label>
            <Input id="account-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-last-name">Last name</Label>
            <Input id="account-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-email">E-mail (sign-in)</Label>
            <Input id="account-email" value={session?.email ?? ''} disabled readOnly />
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div>
          <Button type="submit" disabled={saving || !session}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (!currentPassword) return setError('Type your current password.');
    if (newPassword.length < 8) return setError('The new password needs at least 8 characters.');
    if (newPassword !== repeat) return setError('The two new passwords are not the same.');
    setSaving(true);
    setError(null);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setRepeat('');
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, 'Could not change the password.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      icon={KeyRound}
      title="Change password"
      description="With your current password. Passwords are stored as one-way hashes (bcrypt): nobody can read them, not even the admin."
      testId="settings-password"
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-current">Current password</Label>
            <Input id="password-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-new">New password</Label>
            <Input id="password-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-repeat">New password, again</Label>
            <Input id="password-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Changing…' : 'Change password'}
          </Button>
          <Link href="/profile" className="text-sm text-primary hover:underline">
            Forgot the current one? Get a reset link by e-mail
          </Link>
        </div>
      </form>
    </Section>
  );
}

function OrganisationSection() {
  const { data: organisation } = useOrganisation();
  const update = useUpdateOrganisation();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organisation) setName(organisation.name);
  }, [organisation]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError('The name needs at least 2 characters.');
    setSaved(false);
    setError(null);
    try {
      await update.mutateAsync({ name: name.trim() });
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, 'Could not save the organisation.'));
    }
  }

  return (
    <Section icon={Building2} title="Organisation" description="The agency this platform belongs to." testId="settings-organisation">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organisation-name">Name</Label>
            <Input id="organisation-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organisation-slug">Identifier</Label>
            <Input id="organisation-slug" value={organisation?.slug ?? ''} disabled readOnly />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organisation-created">On the platform since</Label>
            <Input id="organisation-created" value={organisation ? formatDate(organisation.createdAt) : ''} disabled readOnly />
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div>
          <Button type="submit" disabled={update.isPending || !organisation}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PayDefaultsSection() {
  const { data: organisation } = useOrganisation();
  const update = useUpdateOrganisation();
  const [draft, setDraft] = useState({ currency: 'USD', hoursPerDay: '8', daysPerMonth: '21', feePercent: '', paymentTermDays: '30' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organisation) return;
    const d = organisation.payDefaults;
    setDraft({
      currency: d.currency,
      hoursPerDay: String(d.hoursPerDay),
      daysPerMonth: String(d.daysPerMonth),
      feePercent: d.feePercent === null ? '' : String(d.feePercent),
      paymentTermDays: String(d.paymentTermDays),
    });
  }, [organisation]);

  const set = (field: keyof typeof draft) => (event: { target: { value: string } }) => setDraft((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const hours = Number(draft.hoursPerDay);
    const days = Number(draft.daysPerMonth);
    const terms = Number(draft.paymentTermDays);
    const fee = draft.feePercent.trim() === '' ? undefined : Number(draft.feePercent);
    if (!Number.isInteger(hours) || hours < 1 || hours > 24) return setError('Hours per day: a whole number from 1 to 24.');
    if (!Number.isInteger(days) || days < 1 || days > 31) return setError('Days per month: a whole number from 1 to 31.');
    if (fee !== undefined && (Number.isNaN(fee) || fee < 0 || fee > 100)) return setError('Fee: a percentage from 0 to 100.');
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) return setError('Days to pay: a whole number from 0 to 365.');
    setSaved(false);
    setError(null);
    try {
      await update.mutateAsync({ payDefaults: { currency: draft.currency, hoursPerDay: hours, daysPerMonth: days, paymentTermDays: terms, ...(fee !== undefined ? { feePercent: fee } : {}) } });
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, 'Could not save the defaults.'));
    }
  }

  const currencies = CURRENCIES.includes(draft.currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [...CURRENCIES, draft.currency];

  return (
    <Section
      icon={Calculator}
      title="Pay & fee defaults"
      description="What the pay calculation on the pipeline, new fees and new retainers start from. Each one can still be changed per person."
      testId="settings-pay-defaults"
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaults-currency">Currency</Label>
            <Select id="defaults-currency" value={draft.currency} onChange={set('currency')}>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaults-hours">Hours / day</Label>
            <Input id="defaults-hours" type="number" min={1} max={24} value={draft.hoursPerDay} onChange={set('hoursPerDay')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaults-days">Days / month</Label>
            <Input id="defaults-days" type="number" min={1} max={31} value={draft.daysPerMonth} onChange={set('daysPerMonth')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaults-fee">Agency fee %</Label>
            <Input id="defaults-fee" type="number" min={0} max={100} step="0.1" value={draft.feePercent} onChange={set('feePercent')} placeholder="e.g. 15" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaults-terms">Days to pay a fee</Label>
            <Input id="defaults-terms" type="number" min={0} max={365} value={draft.paymentTermDays} onChange={set('paymentTermDays')} />
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div>
          <Button type="submit" disabled={update.isPending || !organisation}>
            {update.isPending ? 'Saving…' : 'Save defaults'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function IntegrationsSection() {
  const { data: integrations, isLoading } = useIntegrations();
  return (
    <Section
      icon={Plug}
      title="Integrations"
      description="What the platform is connected to. The keys are set on the server (its .env file), never here — so they are never shown in the browser."
      testId="settings-integrations"
    >
      {isLoading || !integrations ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {integrations.map((integration) => (
            <li key={integration.key} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{integration.name}</p>
                <p className="text-xs text-foreground/60">{integration.detail}</p>
                {integration.connected ? null : <p className="mt-0.5 break-words font-mono text-[11px] text-foreground/50">{integration.needs.join(' · ')}</p>}
              </div>
              <Badge variant={integration.connected ? 'success' : 'warning'} data-testid="integration-status">
                {integration.connected ? 'Connected' : 'Not set up'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * Settings. Everyone: their own account and password. The admin also: the organisation, the values the pay
 * calculation and the fees start from, what the platform is connected to, and where access is managed.
 */
export default function SettingsPage() {
  const { data: session, isLoading } = useSession();
  if (isLoading || !session) return <p className="text-sm text-foreground/60">Loading…</p>;
  const isAdmin = isAdminSession(session);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-foreground/60">
          {isAdmin ? 'Your account, the organisation, and how the platform works for everyone in it.' : 'Your own account and password.'}
        </p>
      </div>

      <AccountSection />
      <PasswordSection />

      {isAdmin ? (
        <>
          <OrganisationSection />
          <PayDefaultsSection />
          <IntegrationsSection />
          <Section icon={ShieldCheck} title="Users & access" description="Who may sign in, what each user sees, and what was done on the platform." testId="settings-access">
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/profile" className="font-medium text-primary hover:underline">
                  Users
                </Link>{' '}
                — add or delete instructors, choose the categories each one sees, set a new password, switch the e-mail login code on per user.
              </li>
              <li>
                <Link href="/notifications" className="font-medium text-primary hover:underline">
                  Notifications
                </Link>{' '}
                — everything that was done on the platform, and by whom.
              </li>
            </ul>
          </Section>
        </>
      ) : null}
    </div>
  );
}
