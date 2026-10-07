// Usage: node bench.js <label> <apiLogFile> [iterations]
// Measures every read endpoint of the running API (localhost:4010):
//  - latency p50/p95/p99 (sequential), payload bytes
//  - Prisma queries per request (counted from the API's DEBUG=prisma:query log)
//  - stores a normalised "golden" response per URL for before/after equivalence diffs
const fs = require('fs');
const path = require('path');
const S = __dirname;
const [label, logFile, itersArg] = process.argv.slice(2);
const ITERS = Number(itersArg || 20);
const BASE = process.env.API || 'http://localhost:4010';
const API = BASE + '/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

async function login() {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@acme-recruiting.dev', password: 'Password123!' }) });
  const j = await r.json();
  return j.data.accessToken || j.data.tokens?.accessToken;
}
const logSize = () => { try { return fs.statSync(logFile).size; } catch { return 0; } };
function queriesSince(start) {
  const size = logSize();
  if (size <= start) return { n: 0, kinds: {} };
  const fd = fs.openSync(logFile, 'r'); const buf = Buffer.alloc(size - start); fs.readSync(fd, buf, 0, buf.length, start); fs.closeSync(fd);
  const lines = buf.toString('utf8').split('\n').filter((l) => l.includes('prisma:query'));
  const kinds = {}; let n = 0;
  for (const l of lines) {
    const m = l.match(/prisma:query\s+(BEGIN|COMMIT|ROLLBACK|SELECT|INSERT|UPDATE|DELETE|SET|WITH)/i);
    const k = m ? m[1].toUpperCase() : 'OTHER'; kinds[k] = (kinds[k] || 0) + 1; if (!['BEGIN', 'COMMIT', 'ROLLBACK'].includes(k)) n++;
  }
  return { n, kinds };
}
const normalise = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'requestId' ? undefined : v)));

(async () => {
  const token = await login();
  const H = { Authorization: 'Bearer ' + token };
  const get = async (u) => { const t = process.hrtime.bigint(); try { const r = await fetch(API + u, { headers: H, signal: AbortSignal.timeout(180000) }); const txt = await r.text(); return { status: r.status, ms: Number(process.hrtime.bigint() - t) / 1e6, txt }; } catch (e) { return { status: 0, ms: Number(process.hrtime.bigint() - t) / 1e6, txt: 'ERR ' + e.message }; } };
  const firstId = async (e) => { const j = JSON.parse((await get(`/${e}?page=1&pageSize=1`)).txt); const d = j.data; const arr = Array.isArray(d) ? d : d.items || d.data || []; return arr[0]?.id; };
  const [cand, job, comp, contact, app, user] = await Promise.all(['candidates', 'jobs', 'companies', 'contacts', 'applications', 'users'].map(firstId));

  const P = 'page=1&pageSize=20';
  const urls = [
    `/candidates?${P}`, `/candidates?${P}&search=a`, `/candidates?${P}&unassigned=true`, `/candidates?${P}&hasApplications=true`, `/candidates/${cand}`,
    `/companies?${P}`, `/companies?${P}&search=a`, `/companies/${comp}`,
    `/contacts?${P}`, `/contacts?${P}&search=a`, `/contacts/${contact}`,
    `/jobs?${P}`, `/jobs?${P}&search=a`, `/jobs/${job}`,
    `/applications?${P}`, `/applications/${app}`, `/placements?${P}`,
    `/activities?${P}`, `/tasks?${P}`, `/calendar`, `/documents?${P}`,
    `/notifications?${P}`, `/notifications/unread-count`,
    `/pipelines`, `/analytics/dashboard-summary`, `/analytics/overview`, `/reports/overview`,
    `/users?${P}`, `/users/${user}`, `/users/active`, `/teams`, `/roles`, `/audit-logs?${P}`,
    `/auth/me`, `/search?q=a`,
  ];

  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null; const skip = process.env.SKIP ? new RegExp(process.env.SKIP) : null;
  for (let i = urls.length - 1; i >= 0; i--) { if ((only && !only.test(urls[i])) || (skip && skip.test(urls[i]))) urls.splice(i, 1); }
  const goldenDir = path.join(S, 'golden', label); fs.mkdirSync(goldenDir, { recursive: true });
  const results = [];
  for (const u of urls) {
    await get(u); await get(u); // warm-up (JIT, pool)
    const start = logSize();
    const one = await get(u); await sleep(150);
    const q = queriesSince(start);
    const times = [];
    for (let i = 0; i < ITERS; i++) times.push((await get(u)).ms);
    let body; try { body = normalise(JSON.parse(one.txt)); } catch { body = one.txt; }
    fs.writeFileSync(path.join(goldenDir, u.replace(/[^a-z0-9]+/gi, '_') + '.json'), JSON.stringify(body, null, 1));
    const r = { url: u, status: one.status, bytes: Buffer.byteLength(one.txt), queries: q.n, kinds: q.kinds, p50: +pct(times, 50).toFixed(0), p95: +pct(times, 95).toFixed(0), p99: +pct(times, 99).toFixed(0) };
    results.push(r);
    console.log(`${String(r.status).padEnd(4)} q=${String(r.queries).padStart(2)} p50=${String(r.p50).padStart(5)}ms p95=${String(r.p95).padStart(5)}ms ${String(r.bytes).padStart(7)}B  ${u}`);
  }
  // concurrency: 10 parallel dashboard-ish requests x 5 rounds
  const conc = [];
  for (const u of ['/analytics/dashboard-summary', `/candidates?${P}`]) {
    const t = [];
    for (let round = 0; round < 5; round++) { const s = process.hrtime.bigint(); await Promise.all(Array.from({ length: 10 }, () => get(u))); t.push(Number(process.hrtime.bigint() - s) / 1e6); }
    conc.push({ url: u, x10_p50: +pct(t, 50).toFixed(0), x10_max: +Math.max(...t).toFixed(0) });
  }
  console.log('concurrency (10 parallel):', JSON.stringify(conc));
  fs.writeFileSync(path.join(S, `bench-${label}.json`), JSON.stringify({ label, iters: ITERS, results, conc }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
