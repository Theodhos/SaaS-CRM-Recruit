// node load.js <baseUrl> <virtualUsers> <seconds> [label]
// Closed-loop load test: N virtual users, each repeatedly picks a request from a weighted, realistic read mix and fires the next
// one as soon as the previous finishes (no think time = worst case for the server). Reports throughput, error rate and
// p50/p95/p99 overall and per endpoint. Uses one shared login per run (auth cost is measured separately).
const [base, vusArg, secArg, label = 'run'] = process.argv.slice(2);
const VUS = Number(vusArg || 20), SECONDS = Number(secArg || 30);
const API = base + '/api/v1';
const WRITE = Number(process.env.WRITE_PCT || 0) / 100; // share of requests that are writes (each one invalidates the tenant's cache)
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

(async () => {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@acme-recruiting.dev', password: 'Password123!' }) })).json();
  const token = login.data.accessToken || login.data.tokens?.accessToken;
  const H = { Authorization: 'Bearer ' + token };
  const P = 'page=1&pageSize=20';
  // A workday on the CRM: mostly lists and the dashboard, a few detail/search calls. Weights are relative.
  const mix = [
    [30, `/candidates?${P}`], [10, `/candidates?${P}&status=ACTIVE`], [6, `/candidates?page=2&pageSize=20`],
    [12, '/analytics/overview'], [6, '/analytics/dashboard-summary'],
    [10, `/applications?${P}`], [6, `/jobs?${P}`], [6, `/companies?${P}`], [4, `/contacts?${P}`],
    [10, `/tasks?${P}`], [12, '/notifications/unread-count'], [4, `/notifications?${P}`],
    [4, '/search?q=nova'], [4, '/auth/me'],
  ];
  const total = mix.reduce((s, [w]) => s + w, 0);
  const pick = () => { let r = Math.random() * total; for (const [w, u] of mix) { if ((r -= w) <= 0) return u; } return mix[0][1]; };

  const all = [], per = new Map(); let errors = 0, count = 0;
  const end = Date.now() + SECONDS * 1000;
  const t0 = Date.now();
  const vu = async () => {
    while (Date.now() < end) {
      const isWrite = Math.random() < WRITE;
      const u = isWrite ? '/candidates (POST)' : pick(); const s = process.hrtime.bigint();
      try {
        const r = isWrite
          ? await fetch(API + '/candidates', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Load', lastName: 'Writer', email: `load.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com` }), signal: AbortSignal.timeout(60000) })
          : await fetch(API + u, { headers: H, signal: AbortSignal.timeout(60000) });
        await r.arrayBuffer();
        const ms = Number(process.hrtime.bigint() - s) / 1e6;
        count++; if (r.status >= 400) errors++;
        all.push(ms); const key = u.split('?')[0]; (per.get(key) || per.set(key, []).get(key)).push(ms);
      } catch { errors++; count++; }
    }
  };
  await Promise.all(Array.from({ length: VUS }, vu));
  const secs = (Date.now() - t0) / 1000;
  const row = (name, a) => `${name.padEnd(30)} n=${String(a.length).padStart(6)}  p50=${pct(a, 50).toFixed(0).padStart(5)}  p95=${pct(a, 95).toFixed(0).padStart(5)}  p99=${pct(a, 99).toFixed(0).padStart(5)} ms`;
  console.log(`\n### ${label}: ${VUS} virtual users, ${SECONDS}s, ${base}`);
  console.log(`throughput ${(count / secs).toFixed(1)} req/s   requests ${count}   errors ${errors} (${((errors / Math.max(count, 1)) * 100).toFixed(2)}%)`);
  console.log(row('ALL', all));
  for (const [k, a] of [...per.entries()].sort((x, y) => y[1].length - x[1].length)) console.log('  ' + row(k, a));
  require('fs').writeFileSync(`load-${label}.json`, JSON.stringify({ label, vus: VUS, seconds: SECONDS, rps: +(count / secs).toFixed(1), errors, count, p50: pct(all, 50), p95: pct(all, 95), p99: pct(all, 99) }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
