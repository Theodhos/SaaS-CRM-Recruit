// node --require prisma-tap.js dist/main.js
// env: TAP_LOG=<file>, TAP_CLIENT=<path to packages/database/src/generated/client>, TAP_FULL=<jsonl file, optional>
// packages/database/src/client.ts does `globalThis.__crmPrismaClient ?? createPrismaClient()`, so pre-seeding the
// global with an identical client that also emits 'query' events lets us count SQL statements per request.
// Measurement only; no project source is modified.
const fs = require('fs');
const { PrismaClient } = require(process.env.TAP_CLIENT);
const logFile = process.env.TAP_LOG;
const fullFile = process.env.TAP_FULL;
const client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }, 'warn', 'error'] });
client.$on('query', (e) => {
  const sql = String(e.query).replace(/\s+/g, ' ');
  fs.appendFileSync(logFile, `prisma:query ${sql.slice(0, 200)} dur=${e.duration}ms\n`);
  if (fullFile) fs.appendFileSync(fullFile, JSON.stringify({ sql: e.query, params: e.params, dur: Number(e.duration) }) + '\n');
});
globalThis.__crmPrismaClient = client;
