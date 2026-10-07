// Isolated scratch Postgres 16 for load tests (never touches the project's Supabase DB).
const path = require('path');
const fs = require('fs');
const EmbeddedPostgres = require('embedded-postgres').default;
const dir = path.join(__dirname, 'data');
(async () => {
  const fresh = !fs.existsSync(path.join(dir, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir, user: 'postgres', password: 'perf', port: 54329, persistent: true,
    postgresFlags: ['-c', 'shared_buffers=512MB', '-c', 'work_mem=32MB', '-c', 'max_connections=100', '-c', 'fsync=off', '-c', 'synchronous_commit=off', '-c', 'full_page_writes=off', '-c', 'maintenance_work_mem=512MB'],
  });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase('crm_perf');
  console.log('PG_READY 54329');
  process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
  setInterval(() => {}, 1 << 30);
})().catch((e) => { console.error('PG_FAIL', e); process.exit(1); });
