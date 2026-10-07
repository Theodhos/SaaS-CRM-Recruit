// node ab-index.js <tap-full.jsonl> <key:indexToDrop> ...
// For each suspicious query: 7 interleaved runs WITH the index vs WITHOUT it. "Without" is produced by
// DROP INDEX inside a transaction that is rolled back, so the index is never actually lost.
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
const [file, ...pairs] = process.argv.slice(2);
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const tpl = new Map();
for (const r of rows) {
  if (!/^\s*SELECT/i.test(r.sql)) continue;
  const key = crypto.createHash('md5').update(r.sql).digest('hex').slice(0, 8);
  tpl.set(key, { sql: r.sql, params: r.params });
}
const parse = (t) => { try { return JSON.parse(t).map((p) => (p === null ? null : typeof p === 'object' ? JSON.stringify(p) : String(p))); } catch { return []; } };
const S = '"recruitment_crm"';
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:perf@localhost:54329/crm_perf?options=-csearch_path%3Drecruitment_crm' });
  await c.connect();
  await c.query('set max_parallel_workers_per_gather = 0');
  const run = async (q) => {
    const r = await c.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${q.sql}`, parse(q.params));
    return r.rows[0]['QUERY PLAN'][0]['Execution Time'];
  };
  for (const pair of pairs) {
    const [key, idx] = pair.split(':');
    const q = tpl.get(key); if (!q) { console.log(`${key}: not found`); continue; }
    const withIdx = [], without = [];
    for (let i = 0; i < 7; i++) {
      withIdx.push(await run(q));
      await c.query('begin');
      if (idx && idx !== '-') await c.query(`drop index ${S}."${idx}"`);
      without.push(await run(q));
      await c.query('rollback');
    }
    const tag = q.sql.replace(/"recruitment_crm"\./g, '').replace(/\s+/g, ' ').replace(/SELECT .*? FROM/, 'SELECT … FROM').slice(0, 90);
    console.log(`[${key}] drop ${(idx || '-').padEnd(24)} with-index median ${median(withIdx).toFixed(0).padStart(5)} ms (min ${Math.min(...withIdx).toFixed(0)}, max ${Math.max(...withIdx).toFixed(0)})   without ${median(without).toFixed(0).padStart(5)} ms (min ${Math.min(...without).toFixed(0)}, max ${Math.max(...without).toFixed(0)})   ${tag}`);
  }
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
