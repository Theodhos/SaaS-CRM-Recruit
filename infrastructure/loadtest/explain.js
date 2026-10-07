// node explain.js <tap-full.jsonl> [minMs] [label]
// Replays the real SELECTs Prisma issued (captured by prisma-tap.js) under EXPLAIN (ANALYZE, BUFFERS) on the scratch DB.
const fs = require('fs');
const { Client } = require('pg');
const [file, minMsArg, label] = process.argv.slice(2);
const minMs = Number(minMsArg || 0);
const crypto = require('crypto');

const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byTpl = new Map();
for (const r of rows) {
  if (!/^\s*SELECT/i.test(r.sql)) continue;
  const key = crypto.createHash('md5').update(r.sql).digest('hex').slice(0, 8);
  const e = byTpl.get(key) || { key, sql: r.sql, params: r.params, n: 0, maxDur: 0 };
  e.n++; e.maxDur = Math.max(e.maxDur, r.dur); e.params = r.params;
  byTpl.set(key, e);
}

const walk = (node, acc) => {
  acc.push(node);
  for (const c of node.Plans || []) walk(c, acc);
  return acc;
};

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:perf@localhost:54329/crm_perf?options=-csearch_path%3Drecruitment_crm' });
  await c.connect();
  const out = [];
  for (const t of [...byTpl.values()].sort((a, b) => b.maxDur - a.maxDur)) {
    if (t.maxDur < minMs) continue;
    let params = [];
    try { params = JSON.parse(t.params); } catch { /* no params */ }
    // Prisma logs booleans/numbers/strings; pg needs text for untyped params
    params = params.map((p) => (p === null ? null : typeof p === 'object' ? JSON.stringify(p) : String(p)));
    let rec = { key: t.key, calls: t.n, prismaMs: t.maxDur, sql: t.sql.replace(/\s+/g, ' ').slice(0, 170) };
    try {
      const r = await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${t.sql}`, params);
      const plan = r.rows[0]['QUERY PLAN'][0];
      const nodes = walk(plan.Plan, []);
      const scans = nodes.filter((n) => /Scan/.test(n['Node Type'])).map((n) => `${n['Node Type']}${n['Index Name'] ? '(' + n['Index Name'] + ')' : ''} ${n['Relation Name'] || ''} rows=${n['Actual Rows']}${n['Rows Removed by Filter'] ? ' removed=' + n['Rows Removed by Filter'] : ''}`);
      rec = { ...rec, execMs: +plan['Execution Time'].toFixed(1), planMs: +plan['Planning Time'].toFixed(1), buffers: (plan.Plan['Shared Hit Blocks'] || 0) + (plan.Plan['Shared Read Blocks'] || 0), scans, sort: nodes.filter((n) => n['Node Type'] === 'Sort').map((n) => `${n['Sort Method']} ${n['Sort Space Used'] || ''}kB`) };
    } catch (e) { rec.error = e.message.slice(0, 100); }
    out.push(rec);
  }
  fs.writeFileSync(`explain-${label || 'run'}.json`, JSON.stringify(out, null, 1));
  for (const r of out) {
    console.log(`\n[${r.key}] exec=${r.execMs ?? '-'}ms plan=${r.planMs ?? '-'}ms buffers=${r.buffers ?? '-'} (prisma saw ${r.prismaMs}ms, ${r.calls}x)${r.error ? ' ERR ' + r.error : ''}`);
    console.log('  ' + r.sql);
    for (const s of r.scans || []) console.log('   - ' + s);
    if (r.sort?.length) console.log('   sort: ' + r.sort.join(' | '));
  }
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
