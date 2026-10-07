'use client';

import type { User } from '@crm/types';
import { Button, Dialog, Input } from '@crm/ui';
import type { CreateUserInput } from '@crm/validation';
import { Plus, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { useSession } from '@/hooks/use-session';
import { useCreateUser, useDeactivateUser, useDeleteUser, useUpdateUser, useUsers, useUsersWorkload } from '@/hooks/use-users';
import { ApiClientError } from '@/lib/api-client';
import { toFormDefaults } from '@/lib/form-defaults';
import { generatePassword } from '@/lib/password';

import { userColumns } from './columns';
import { PasswordDialog } from './password-dialog';
import { UserForm } from './user-form';

/**
 * The admin's directory of instructors: who they are, what each has built (companies, jobs, candidates, active
 * employees — the records they see in their own account), and their password (set a new one and it is shown once —
 * passwords are stored as one-way hashes and can never be read back). Click an instructor for the full picture.
 * By default only active instructors are listed; "Show all accounts" adds admins and deactivated users.
 */
export function UsersDirectory() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // every account is listed; untick to see the active instructors only
  const [showAll, setShowAll] = useState(true);
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [shownPassword, setShownPassword] = useState<{ title: string; email: string; password: string; note?: string } | null>(null);

  const { data, isLoading } = useUsers({ page, pageSize: 50, search: search || undefined });
  const { data: workloadRows } = useUsersWorkload();
  const workload = useMemo(() => new Map((workloadRows ?? []).map((w) => [w.userId, w])), [workloadRows]);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const deleteUser = useDeleteUser();
  const { data: session } = useSession();
  // the organisation's owner: its first admin
  const ownerId = useMemo(
    () => [...(data?.items ?? [])].filter((u) => u.role.name === 'Admin').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id,
    [data],
  );

  const instructors = useMemo(
    () => (data?.items ?? []).filter((u) => showAll || (u.status !== 'DEACTIVATED' && u.role.name !== 'Admin')),
    [data, showAll],
  );

  async function handleSubmit(values: CreateUserInput) {
    if (dialogState?.mode === 'edit' && dialogState.user) {
      await updateUser.mutateAsync({ id: dialogState.user.id, input: values });
      setDialogState(null);
      return;
    }
    const result = await createUser.mutateAsync(values);
    setDialogState(null);
    // The password is shown once: the generated one, or the one the admin just typed.
    const password = result.temporaryPassword ?? values.password;
    if (password) {
      setShownPassword({ title: 'Instructor created', email: result.user.email, password, note: 'They sign in with this password' });
    }
  }

  async function handleResetPassword(user: User) {
    if (!window.confirm(`Set a new password for ${user.firstName} ${user.lastName}? Their current password stops working.`)) return;
    const password = generatePassword();
    await updateUser.mutateAsync({ id: user.id, input: { password } });
    setShownPassword({ title: 'New password set', email: user.email, password, note: 'Their previous password no longer works' });
  }

  async function handleDelete(user: User) {
    if (
      !window.confirm(
        `Delete ${user.firstName} ${user.lastName} for good? They can no longer sign in, and the companies, candidates and jobs they added pass to you. This can't be undone.`,
      )
    )
      return;
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (error) {
      window.alert(error instanceof ApiClientError ? error.message : 'Could not delete this user.');
    }
  }

  function handleDeactivate(user: User) {
    if (window.confirm(`Deactivate ${user.firstName} ${user.lastName}? They will no longer be able to sign in.`)) {
      deactivateUser.mutate(user.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Users</h3>
          <p className="mt-1 text-sm text-foreground/60">
            Every account in the organisation, what each one has built, and their access. Click one for details.
          </p>
        </div>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setDialogState({ mode: 'create' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Instructor
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search instructors…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4" />
          Show all accounts (admins &amp; deactivated)
        </label>
      </div>

      {data && data.totalItems === 0 && !search ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Users className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No instructors yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">Add the people on your team; each one gets their own account.</p>
        </div>
      ) : (
        <DataTable
          columns={userColumns({
            workload,
            onEdit: (user) => setDialogState({ mode: 'edit', user }),
            onDeactivate: handleDeactivate,
            onDelete: (user) => void handleDelete(user),
            canDelete: (user) => user.id !== session?.id && user.id !== ownerId,
            onResetPassword: (user) => void handleResetPassword(user),
          })}
          data={instructors}
          isLoading={isLoading}
          page={1}
          pageSize={Math.max(instructors.length, 1)}
          totalItems={instructors.length}
          totalPages={1}
          onPageChange={setPage}
          onRowClick={(user) => router.push(`/users/${user.id}`)}
          emptyMessage={showAll ? 'No accounts found.' : 'No active instructors — tick "Show all accounts" to see admins and deactivated users.'}
        />
      )}

      {dialogState ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          title={dialogState.mode === 'edit' ? 'Edit instructor' : 'Add instructor'}
        >
          <UserForm
            defaultValues={dialogState.user ? toFormDefaults(dialogState.user) : undefined}
            submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create instructor'}
            onSubmit={handleSubmit}
            isEdit={dialogState.mode === 'edit'}
          />
        </Dialog>
      ) : null}

      {shownPassword ? <PasswordDialog {...shownPassword} onClose={() => setShownPassword(null)} /> : null}
    </div>
  );
}
