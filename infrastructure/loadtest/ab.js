// Interleaved A/B: node ab.js <baseA> <baseB> <logA> <logB> [rounds]
// For every read endpoint: alternate requests A,B,B,A,... so machine noise / cache warmth hits both sides equally.
// Reports p50/p95 per side, the B/A ratio, Prisma statements per request, and whether the two JSON bodies are identical.
const fs = require('fs');
const [baseA, baseB, logA, logB, roundsArg] = process.argv.slice(2);
const ROUNDS = Number(roundsArg || 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const stable = (o) => JSON.stringify(o, (k, v) => (k === 'requestId' ? undefined : v));
const logSize = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };
function stmts(f, start) {
  const size = logSize(f); if (size <= start) return 0;
  const fd = fs.openSync(f, 'r'); const buf = Buffer.alloc(size - start); fs.readSync(fd, buf, 0, buf.length, start); fs.closeSync(fd);
  return buf.toString('utf8').split('\n').filter((l) => /prisma:query\s+(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(l)).length;
}
async function login(base) {
  const r = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@acme-recruiting.dev', password: 'Password123!' }) });
  const j = await r.json(); return j.data.accessToken || j.data.tokens?.accessToken;
}
(async () => {
  const [tA, tB] = await Promise.all([login(baseA), login(baseB)]);
  const call = async (base, tok, u) => { const t = process.hrtime.bigint(); try { const r = await fetch(base + '/api/v1' + u, { headers: { Authorization: 'Bearer ' + tok }, signal: AbortSignal.timeout(120000) }); const txt = await r.text(); return { ms: Number(process.hrtime.bigint() - t) / 1e6, status: r.status, txt }; } catch (e) { return { ms: 0, status: 0, txt: 'ERR ' + e.message }; } };
  const first = async (e) => { const j = JSON.parse((await call(baseA, tA, `/${e}?page=1&pageSize=1`)).txt); const d = j.data; return (Array.isArray(d) ? d : d.items || d.data || [])[0]?.id; };
  const [cand, job, comp, contact, app, user] = await Promise.all(['candidates', 'jobs', 'companies', 'contacts', 'applications', 'users'].map(first));
  const P = 'page=1&pageSize=20';
  const urls = [
    `/candidates?${P}`, `/candidates?${P}&search=a`, `/candidates?${P}&search=nova`, `/candidates?${P}&status=ACTIVE`, `/candidates?${P}&unassigned=true`, `/candidates?${P}&hasApplications=true`, `/candidates/${cand}`,
    `/companies?${P}`, `/companies?${P}&search=capital`, `/companies/${comp}`, `/contacts?${P}`, `/contacts/${contact}`, `/jobs?${P}`, `/jobs?${P}&status=OPEN`, `/jobs/${job}`,
    `/applications?${P}`, `/applications/${app}`, `/placements?${P}`, `/activities?${P}`, `/tasks?${P}`, `/calendar`, `/documents?${P}`,
    `/notifications?${P}`, `/notifications/unread-count`, `/pipelines`, `/analytics/dashboard-summary`, `/analytics/overview`,
    `/users?${P}`, `/users/${user}`, `/users/active`, `/teams`, `/roles`, `/audit-logs?${P}`, `/auth/me`, `/search?q=a`,
  ];
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const rows = [];
  for (const u of urls.filter((x) => !only || only.test(x))) {
    for (let i = 0; i < 2; i++) { await call(baseA, tA, u); await call(baseB, tB, u); }
    const sA = logSize(logA); const a1 = await call(baseA, tA, u); await sleep(120); const qA = stmts(logA, sA);
    const sB = logSize(logB); const b1 = await call(baseB, tB, u); await sleep(120); const qB = stmts(logB, sB);
    const same = a1.status === b1.status && stable(safe(a1.txt)) === stable(safe(b1.txt));
    const A = [], B = [];
    for (let r = 0; r < ROUNDS; r++) {
      if (r % 2 === 0) { A.push((await call(baseA, tA, u)).ms); B.push((await call(baseB, tB, u)).ms); }
      else { B.push((await call(baseB, tB, u)).ms); A.push((await call(baseA, tA, u)).ms); }
    }
    const row = { url: u, status: a1.status, identical: same, qA, qB, a50: +pct(A, 50).toFixed(0), a95: +pct(A, 95).toFixed(0), b50: +pct(B, 50).toFixed(0), b95: +pct(B, 95).toFixed(0), ratio: +(pct(B, 50) / Math.max(pct(A, 50), 0.001)).toFixed(2) };
    rows.push(row);
    console.log(`${row.identical ? 'SAME' : 'DIFF'} q ${String(qA).padStart(2)}->${String(qB).padStart(2)}  p50 ${String(row.a50).padStart(5)} -> ${String(row.b50).padStart(5)} ms (x${row.ratio})  p95 ${String(row.a95).padStart(5)} -> ${String(row.b95).padStart(5)}  ${u}`);
  }
  fs.writeFileSync(process.env.OUT || 'ab-result.json', JSON.stringify(rows, null, 1));
  const diffs = rows.filter((r) => !r.identical); console.log(`\nresponses identical: ${rows.length - diffs.length}/${rows.length}` + (diffs.length ? `  DIFFERENT: ${diffs.map((d) => d.url).join(' , ')}` : ''));
  function safe(t) { try { return JSON.parse(t); } catch { return t; } }
})().catch((e) => { console.error(e); process.exit(1); });
