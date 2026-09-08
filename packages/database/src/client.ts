import { PrismaClient } from './generated/client';

// Prevent exhausting the Postgres connection pool from hot-reloading in dev
// (each reload would otherwise instantiate a new PrismaClient).
declare global {
  // eslint-disable-next-line no-var
  var __crmPrismaClient: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalThis.__crmPrismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__crmPrismaClient = prisma;
}
