// node index-experiment.js <tap-full.jsonl>
// 1) replays every real SELECT and records: EXPLAIN ANALYZE time, and the returned row ids (for equivalence)
// 2) creates the candidate indexes (timing + size), ANALYZE
// 3) replays again and compares: time, plan nodes, AND that the exact same rows come back in the same order.
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
const file = process.argv[2];
const S = '"recruitment_crm"';

const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const tpl = new Map();
for (const r of rows) {
  if (!/^\s*SELECT/i.test(r.sql)) continue;
  const key = crypto.createHash('md5').update(r.sql).digest('hex').slice(0, 8);
  const e = tpl.get(key) || { key, sql: r.sql, params: r.params, n: 0, max: 0 };
  e.n++; e.max = Math.max(e.max, r.dur); e.params = r.params; tpl.set(key, e);
}
const queries = [...tpl.values()].filter((t) => t.max >= 25).sort((a, b) => b.max - a.max);

const INDEXES = [
  ['candidates', 'cand_org_created_live', `("organisationId","createdAt" DESC) WHERE "deletedAt" IS NULL`],
  ['candidates', 'cand_org_status_created_live', `("organisationId","status","createdAt" DESC) WHERE "deletedAt" IS NULL`],
  ['applications', 'app_org_applied_live', `("organisationId","appliedAt" DESC) WHERE "deletedAt" IS NULL`],
  ['tasks', 'task_org_due_created', `("organisationId","dueDate","createdAt" DESC)`],
  ['notifications', 'notif_user_org_created', `("userId","organisationId","createdAt" DESC)`],
  ['notifications', 'notif_user_org_unread', `("userId","organisationId") WHERE "readAt" IS NULL`],
  ['companies', 'comp_org_created_live', `("organisationId","createdAt" DESC) WHERE "deletedAt" IS NULL`],
  ['contacts', 'cont_org_created_live', `("organisationId","createdAt" DESC) WHERE "deletedAt" IS NULL`],
  ['jobs', 'job_org_created_live', `("organisationId","createdAt" DESC) WHERE "deletedAt" IS NULL`],
];

const walk = (n, acc = []) => { acc.push(n); (n.Plans || []).forEach((c) => walk(c, acc)); return acc; };
const parse = (t) => { try { return JSON.parse(t).map((p) => (p === null ? null : typeof p === 'object' ? JSON.stringify(p) : String(p))); } catch { return []; } };

async function measure(c, q) {
  const params = parse(q.params);
  // best of 3 (warm), the first also captures the plan
  let best = Infinity, plan = null;
  for (let i = 0; i < 3; i++) {
    const r = await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.sql}`, params);
    const p = r.rows[0]['QUERY PLAN'][0];
    if (p['Execution Time'] < best) { best = p['Execution Time']; plan = p; }
  }
  const nodes = walk(plan.Plan);
  const scans = nodes.filter((n) => /Scan/.test(n['Node Type'])).map((n) => `${n['Node Type'].replace(' Scan', '')}${n['Index Name'] ? '[' + n['Index Name'].replace(/^.*_(idx)?$/, '$&') + ']' : ''} ${n['Relation Name'] || ''}`.trim());
  // rows actually returned, for equivalence (only for row-returning queries, not COUNT(*)
  let ids = null;
  if (!/SELECT COUNT\(\*\)/i.test(q.sql.trim().slice(0, 40)) && !/GROUP BY/i.test(q.sql)) {
    const r = await c.query(q.sql, params);
    ids = r.rows.map((x) => x.id ?? JSON.stringify(x).slice(0, 60));
  } else if (/^\s*SELECT COUNT\(\*\)/i.test(q.sql)) {
    const r = await c.query(q.sql, params); ids = [String(Object.values(r.rows[0])[0])];
  }
  return { ms: +best.toFixed(1), scans, buffers: (plan.Plan['Shared Hit Blocks'] || 0) + (plan.Plan['Shared Read Blocks'] || 0), ids };
}

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:perf@localhost:54329/crm_perf?options=-csearch_path%3Drecruitment_crm' });
  await c.connect();
  await c.query('set max_parallel_workers_per_gather = 0'); // deterministic single-process timings
  console.log(`replaying ${queries.length} real SELECTs (>=25 ms in the app) ...`);
  const before = {};
  for (const q of queries) before[q.key] = await measure(c, q);

  console.log('\n--- creating indexes');
  for (const [table, name, def] of INDEXES) {
    const t = Date.now();
    await c.query(`create index if not exists ${name} on ${S}."${table}" ${def}`);
    const size = (await c.query(`select pg_size_pretty(pg_relation_size('${S}.${name}'::regclass)) s`)).rows[0].s;
    console.log(`  ${name.padEnd(30)} ${(((Date.now() - t) / 1000).toFixed(1) + 's').padStart(7)}  ${size}`);
  }
  for (const t of ['candidates', 'applications', 'tasks', 'notifications', 'companies', 'contacts', 'jobs']) await c.query(`vacuum (analyze) ${S}."${t}"`);

  console.log('\n--- before -> after (best of 3, warm)');
  let same = 0, diff = 0;
  const out = [];
  for (const q of queries) {
    const b = before[q.key]; const a = await measure(c, q);
    const equal = b.ids && a.ids ? JSON.stringify(b.ids) === JSON.stringify(a.ids) : null;
    if (equal === true) same++; else if (equal === false) diff++;
    const tag = q.sql.replace(/"recruitment_crm"\./g, '').replace(/\s+/g, ' ').replace(/SELECT .*? FROM/, 'SELECT … FROM').slice(0, 110);
    out.push({ key: q.key, before: b.ms, after: a.ms, equal, scansBefore: b.scans, scansAfter: a.scans });
    console.log(`[${q.key}] ${String(b.ms).padStart(7)} -> ${String(a.ms).padStart(7)} ms  rows:${equal === null ? ' n/a' : equal ? ' SAME' : ' DIFFERENT'}  ${tag}`);
    if (JSON.stringify(b.scans) !== JSON.stringify(a.scans)) console.log(`         plan: ${b.scans.join(' + ')}  =>  ${a.scans.join(' + ')}`);
  }
  console.log(`\nrow-for-row identical results: ${same}  different: ${diff}`);
  fs.writeFileSync('index-experiment.json', JSON.stringify(out, null, 1));
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
