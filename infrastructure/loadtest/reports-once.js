// One timed call to /reports/overview with API memory sampling. node reports-once.js <apiPort> <apiPid> [timeoutSec]
const { execSync } = require('child_process');
const [port, pid, tmo] = process.argv.slice(2);
const API = `http://localhost:${port}/api/v1`;
const rss = () => { try { return Number(execSync(`powershell -NoProfile -c "(Get-Process -Id ${pid}).WorkingSet64"`).toString().trim()) / 1048576; } catch { return NaN; } };
(async () => {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@acme-recruiting.dev', password: 'Password123!' }) })).json();
  const token = login.data.accessToken || login.data.tokens?.accessToken;
  const base = rss(); let peak = base; const t0 = Date.now();
  const timer = setInterval(() => { const m = rss(); if (m > peak) peak = m; }, 1500);
  let status = 0, bytes = 0, err = '';
  try { const r = await fetch(API + '/reports/overview', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(Number(tmo || 600) * 1000) }); status = r.status; bytes = (await r.text()).length; } catch (e) { err = e.message; }
  clearInterval(timer);
  console.log(JSON.stringify({ endpoint: '/reports/overview', status, bytes, err, seconds: +((Date.now() - t0) / 1000).toFixed(1), rss_before_MB: Math.round(base), rss_peak_MB: Math.round(Math.max(peak, rss())) }));
})();
