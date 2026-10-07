/**
 * Code-defined permission catalog. This is system configuration, not demo
 * data — Permission rows are global capability identifiers referenced by
 * guards/decorators throughout apps/api (see packages/auth). Add new
 * permissions here as new modules/actions are built; never hand-create them
 * per tenant.
 */
export interface PermissionSeed {
  key: string;
  module: string;
  description: string;
}

const CRUD_MODULES = [
  'candidate',
  'company',
  'contact',
  'job',
  'application',
  'placement',
  'task',
  'document',
  'activity',
  'calendar',
] as const;

const crudPermissions: PermissionSeed[] = CRUD_MODULES.flatMap((module) => [
  { key: `${module}:create`, module, description: `Create ${module} records` },
  { key: `${module}:read`, module, description: `Read ${module} records` },
  { key: `${module}:update`, module, description: `Update ${module} records` },
  { key: `${module}:delete`, module, description: `Delete ${module} records` },
]);

const additionalPermissions: PermissionSeed[] = [
  { key: 'reports:view', module: 'reports', description: 'View reports' },
  { key: 'analytics:view', module: 'analytics', description: 'View analytics dashboards' },
  { key: 'settings:manage', module: 'settings', description: 'Manage organisation settings' },
  { key: 'users:manage', module: 'users', description: 'Manage users, roles, and teams' },
  // Notifications are system-generated, never authored by a user directly —
  // no create/update permission, just read (the bell/list) and delete/dismiss.
  { key: 'notification:read', module: 'notification', description: 'View notifications' },
  { key: 'notification:delete', module: 'notification', description: 'Dismiss notifications' },
];

export const permissionSeeds: PermissionSeed[] = [...crudPermissions, ...additionalPermissions];
