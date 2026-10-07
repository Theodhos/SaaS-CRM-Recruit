'use client';

import type { User } from '@crm/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog } from '@crm/ui';
import { Briefcase, Building2, LayoutGrid, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ASSIGNABLE_NAV_GROUPS, isSectionAllowed } from '@/components/navigation';
import { useCandidates } from '@/hooks/use-candidates';
import { useCompanies } from '@/hooks/use-companies';
import { useJobs } from '@/hooks/use-jobs';
import { useUpdateUser } from '@/hooks/use-users';
import { toFormDefaults } from '@/lib/form-defaults';

import { UserForm } from './user-form';

function RecordList({ title, icon: Icon, total, rows, empty }: {
  title: string;
  icon: typeof Users;
  total: number | undefined;
  rows: { id: string; href: string; name: string; detail: string }[];
  empty: string;
}) {
  return (
    <Card data-testid={`records-${title.toLowerCase()}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-foreground/50" /> {title} ({total ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-foreground/50">{empty}</p>
        ) : (
          <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto text-sm">
            {rows.map((row) => (
              <li key={row.id} className="py-2">
                <Link href={row.href} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="text-xs text-foreground/50">{row.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * On the admin's page of one instructor: the CRM categories the admin gave them (and the way to change them), and
 * the companies, candidates and jobs that instructor added.
 */
export function InstructorRecords({ user }: { user: User }) {
  const { data: companies } = useCompanies({ ownerId: user.id, pageSize: 100 });
  const { data: candidates } = useCandidates({ ownerId: user.id, pageSize: 100 });
  const { data: jobs } = useJobs({ ownerId: user.id, pageSize: 100 });
  const updateUser = useUpdateUser();
  const [editing, setEditing] = useState(false);

  const isAdmin = user.role.name === 'Admin';

  return (
    <>
      <Card data-testid="user-categories">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-foreground/50" /> CRM categories
          </CardTitle>
          <Button type="button" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Change
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground/60">
            {isAdmin
              ? 'An admin sees every category.'
              : `What ${user.firstName} sees in their own menu. You decide it here; they cannot change it.`}
          </p>
          {ASSIGNABLE_NAV_GROUPS.map((group) => {
            const given = group.items.filter((item) => isAdmin || isSectionAllowed(item.href, user.allowedSections));
            return (
              <div key={group.label} className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="w-32 shrink-0 font-medium">{group.label}</span>
                {given.length === 0 ? (
                  <span className="text-foreground/40">not given</span>
                ) : (
                  given.map((item) => (
                    <Badge key={item.href} variant="outline">
                      {item.label}
                    </Badge>
                  ))
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecordList
          title="Companies"
          icon={Building2}
          total={companies?.totalItems}
          empty={`${user.firstName} has not added a company yet.`}
          rows={(companies?.items ?? []).map((c) => ({ id: c.id, href: `/companies/${c.id}`, name: c.name, detail: [c.industry, c.city].filter(Boolean).join(' · ') || '—' }))}
        />
        <RecordList
          title="Candidates"
          icon={Users}
          total={candidates?.totalItems}
          empty={`${user.firstName} has not added a candidate yet.`}
          rows={(candidates?.items ?? []).map((c) => ({
            id: c.id,
            href: `/candidates/${c.id}`,
            name: `${c.firstName} ${c.lastName}`,
            detail: c.currentApplication ? `${c.currentApplication.jobTitle} · ${c.currentApplication.stage}` : (c.jobTitle ?? 'Not on a pipeline'),
          }))}
        />
        <RecordList
          title="Jobs"
          icon={Briefcase}
          total={jobs?.totalItems}
          empty={`${user.firstName} has not added a job yet.`}
          rows={(jobs?.items ?? []).map((j) => ({ id: j.id, href: `/jobs/${j.id}`, name: j.title, detail: [j.company?.name, j.location].filter(Boolean).join(' · ') || '—' }))}
        />
      </div>

      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(false)} title={`${user.firstName} ${user.lastName}`}>
          <UserForm
            isEdit
            defaultValues={toFormDefaults(user)}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await updateUser.mutateAsync({ id: user.id, input: values });
              setEditing(false);
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
