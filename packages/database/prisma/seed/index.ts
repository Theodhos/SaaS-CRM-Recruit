import { PrismaClient } from '../../src/generated/client';

import { seedDevFixtures } from './dev-fixtures';
import { permissionSeeds } from './permissions';

/**
 * Two-tier seed:
 *  1. Permissions — code-defined system reference data, seeded in every
 *     environment including production (idempotent upsert).
 *  2. Dev fixtures — one minimal organisation/user/company/candidate/job/
 *     application graph, seeded ONLY outside production, purely to prove
 *     the schema's relationships work end to end. Never hundreds of fake
 *     records, never run against a real customer's database.
 */
const prisma = new PrismaClient();

async function seedPermissions() {
  for (const permission of permissionSeeds) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }
  console.log(`Seeded ${permissionSeeds.length} permissions.`);
}

async function main() {
  await seedPermissions();

  if (process.env.NODE_ENV !== 'production') {
    await seedDevFixtures(prisma);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
