import { PrismaClient } from './src/generated/client/index.js';

const prisma = new PrismaClient();
try {
  const count = await prisma.organisation.count();
  console.log('CONNECTION OK, organisation count =', count);
} catch (e) {
  console.error('CONNECTION FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
