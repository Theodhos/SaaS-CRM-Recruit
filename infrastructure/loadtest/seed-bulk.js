// node seed-bulk.js <candidates N>   -- synthetic volume on top of the project's dev seed (scratch DB only)
const { Client } = require('pg');
const N = Number(process.argv[2] || 1000000);
const S = '"recruitment_crm"';
const T = (t) => `${S}."${t}"`;
const E = (t) => `${S}."${t}"`;
const ts = (days = 1095) => `(now() - (random()*${days})::int * interval '1 day' - random()*86400 * interval '1 second')`;
const pick = (arr) => `(array[${arr.map((a) => `'${a}'`).join(',')}])[1+floor(random()*${arr.length})::int]`;
const FIRST = ['Alex','Maya','Liam','Noah','Emma','Olivia','Ethan','Sofia','Lucas','Ava','Mateo','Priya','Chen','Amira','Diego','Elena','Farid','Grace','Hiro','Ines'];
const LAST = ['Meyer','Rossi','Wallace','Abbas','Novak','Dubois','Hoffman','Tanaka','Fischer','Nguyen','Nakamura','Silva','Kowalski','Haddad','Petrov','Larsen','Okafor','Costa','Berg','Ivanov'];
const CITY = ['London','Berlin','Paris','Madrid','Rome','Tirana','Vienna','Zurich','Dublin','Oslo'];

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:perf@localhost:54329/crm_perf' });
  await c.connect();
  const q = async (label, sql) => { const t = Date.now(); const r = await c.query(sql); console.log(`${label.padEnd(28)} ${String(r.rowCount ?? '').padStart(9)} rows  ${((Date.now() - t) / 1000).toFixed(1)}s`); };
  await c.query(`truncate ${['candidates','companies','contacts','jobs','applications','activities','tasks','notifications','audit_logs','placements'].map(T).join(',')} cascade`);
  const org = (await c.query(`select id from ${T('organisations')} where slug='acme-recruiting'`)).rows[0].id;
  const users = (await c.query(`select id from ${T('users')} where "organisationId"=$1 order by id`, [org])).rows.map((r) => r.id);
  const pl = (await c.query(`select id from ${T('pipelines')} where "organisationId"=$1 order by "createdAt" limit 1`, [org])).rows[0].id;
  const stages = (await c.query(`select id from ${T('pipeline_stages')} where "pipelineId"=$1 order by "order"`, [pl])).rows.map((r) => r.id);
  const roleId = (await c.query(`select id from ${T('roles')} where "organisationId"=$1 limit 1`, [org])).rows[0].id;
  // second, small tenant (to prove big-tenant data does not slow / leak into others)
  const org2 = 'org_small_tenant';
  await c.query(`insert into ${T('organisations')}(id,name,slug,"updatedAt") values ($1,'Small Co','small-co',now()) on conflict do nothing`, [org2]);
  const orgs = [{ id: org, share: 0.97 }, { id: org2, share: 0.03 }];
  const uarr = `(array[${users.map((u) => `'${u}'`).join(',')}])`;
  const stg = `(array[${stages.map((u) => `'${u}'`).join(',')}])`;
  const own = `${uarr}[1+floor(random()*${users.length})::int]`;
  const nm = (arr) => pick(arr);
  const CH = 500000;

  const N_COMP = Math.max(100, Math.floor(N / 20)), N_CONT = Math.floor(N / 5), N_JOB = Math.floor(N / 10),
    N_APP = Math.floor(N * 1.2), N_ACT = N * 2, N_TASK = Math.floor(N / 2), N_NOTIF = N, N_AUD = N * 2, N_PLC = Math.floor(N / 25);
  const owner = (o) => (o === org ? own : 'null');

  for (const o of orgs) {
    const k = (n) => Math.max(10, Math.floor(n * o.share));
    const tag = o.id === org ? 'A' : 'B';
    const off = o.id === org ? 0 : 10_000_000_000;
    const gs = (n) => `generate_series(${off + 1}, ${off + k(n)}) g(i)`;
    await q(`companies ${tag}`, `insert into ${T('companies')}(id,"organisationId",name,industry,website,email,city,country,status,"ownerId","createdAt","updatedAt","deletedAt")
      select 'co_'||i, '${o.id}', ${nm(LAST)}||' '||${pick(['Capital','Health','Labs','Group','Systems','Logistics'])}||' '||i, ${pick(['Finance','Health','Tech','Retail','Energy'])}, 'https://c'||i||'.example.com','info@c'||i||'.example.com', ${nm(CITY)}, 'GB',
      (${pick(['PROSPECT','ACTIVE_CLIENT','ACTIVE_CLIENT','FORMER_CLIENT','INACTIVE'])})::${E('CompanyStatus')}, ${owner(o.id)}, ${ts()}, now(), case when random()<0.05 then now() else null end from ${gs(N_COMP)}`);
    await q(`contacts ${tag}`, `insert into ${T('contacts')}(id,"organisationId","companyId","firstName","lastName",email,phone,"jobTitle",status,"ownerId","createdAt","updatedAt","deletedAt")
      select 'ct_'||i, '${o.id}', 'co_'||(${off} + 1 + floor(random()*${k(N_COMP)})::int), ${nm(FIRST)}, ${nm(LAST)}, lower(${nm(FIRST)}||'.'||${nm(LAST)}||i||'@corp.example.com'), '+4470'||lpad((random()*99999999)::int::text,8,'0'), ${pick(['CTO','HR Manager','Recruiter','CEO','Head of Talent'])},
      (${pick(['ACTIVE','ACTIVE','ACTIVE','INACTIVE'])})::${E('ContactStatus')}, ${owner(o.id)}, ${ts()}, now(), case when random()<0.05 then now() else null end from ${gs(N_CONT)}`);
    await q(`jobs ${tag}`, `insert into ${T('jobs')}(id,"organisationId","companyId",title,description,location,"employmentType",status,"ownerId","openedAt","createdAt","updatedAt","deletedAt")
      select 'jb_'||i, '${o.id}', 'co_'||(${off} + 1 + floor(random()*${k(N_COMP)})::int), ${pick(['Senior Engineer','Product Manager','Data Analyst','Designer','Account Executive','DevOps Engineer'])}||' #'||i, repeat('Lorem ipsum dolor sit amet. ', 6), ${nm(CITY)},
      (${pick(['PERMANENT','PERMANENT','CONTRACT','TEMPORARY','PART_TIME'])})::${E('EmploymentType')}, (${pick(['OPEN','OPEN','OPEN','ON_HOLD','CLOSED'])})::${E('JobStatus')}, ${owner(o.id)}, ${ts()}, ${ts()}, now(), case when random()<0.05 then now() else null end from ${gs(N_JOB)}`);
    // candidates in chunks
    const nc = k(N);
    for (let s = 0; s < nc; s += CH) {
      const a = off + s + 1, b = off + Math.min(nc, s + CH);
      await q(`candidates ${tag} ${s}`, `insert into ${T('candidates')}(id,"organisationId","firstName","lastName",email,phone,location,"jobTitle","currentCompany",source,status,"ownerId","createdAt","updatedAt","deletedAt","companyId","interestedJobId")
        select 'cd_'||i, '${o.id}', ${nm(FIRST)}, ${nm(LAST)}, lower(${nm(FIRST)}||'.'||${nm(LAST)}||i||'@example.com'), '+4477'||lpad((random()*99999999)::int::text,8,'0'), ${nm(CITY)}, ${pick(['Engineer','Manager','Analyst','Designer','Consultant'])}, ${nm(LAST)}||' Ltd', ${pick(['LinkedIn','Referral','Website','Agency'])},
        (case when random()<0.7 then 'ACTIVE' when random()<0.6 then 'PASSIVE' when random()<0.5 then 'PLACED' else 'ARCHIVED' end)::${E('CandidateStatus')}, ${owner(o.id)}, ${ts()}, now(), case when random()<0.05 then now() else null end,
        case when random()<0.3 then 'co_'||(${off} + 1 + floor(random()*${k(N_COMP)})::int) else null end, case when random()<0.3 then 'jb_'||(${off} + 1 + floor(random()*${k(N_JOB)})::int) else null end
        from generate_series(${a}, ${b}) g(i)`);
    }
    for (let s = 0; s < k(N_APP); s += CH) {
      const a = off + s + 1, b = off + Math.min(k(N_APP), s + CH);
      await q(`applications ${tag} ${s}`, `insert into ${T('applications')}(id,"organisationId","candidateId","jobId","pipelineId","pipelineStageId",status,source,"ownerId","appliedAt","createdAt","updatedAt","deletedAt")
        select 'ap_'||i, '${o.id}', 'cd_'||(${off} + ((i-${off}-1) % ${k(N)}) + 1), 'jb_'||(${off} + ((((i-${off}-1)*37) + (((i-${off}-1) / ${k(N)})*101)) % ${k(N_JOB)}) + 1), '${pl}', ${stg}[1+floor(random()*${stages.length})::int],
        (${pick(['ACTIVE','ACTIVE','ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','PLACED'])})::${E('ApplicationStatus')}, (${pick(['SOURCED','INBOUND','REFERRAL','JOB_BOARD','OTHER'])})::${E('ApplicationSource')}, ${owner(o.id)}, ${ts()}, ${ts()}, now(), case when random()<0.03 then now() else null end
        from generate_series(${a}, ${b}) g(i)`);
    }
    for (let s = 0; s < k(N_ACT); s += CH) {
      const a = off + s + 1, b = off + Math.min(k(N_ACT), s + CH);
      await q(`activities ${tag} ${s}`, `insert into ${T('activities')}(id,"organisationId",type,subject,description,"userId","candidateId","createdAt")
        select 'ac_'||i, '${o.id}', (${pick(['CALL','EMAIL','MEETING','NOTE','FOLLOW_UP','STATUS_CHANGE'])})::${E('ActivityType')}, 'Activity '||i, 'Some notes '||i, ${uarr}[1+floor(random()*${users.length})::int], 'cd_'||(${off} + 1 + floor(random()*${k(N)})::int), ${ts()}
        from generate_series(${a}, ${b}) g(i)`);
    }
    await q(`tasks ${tag}`, `insert into ${T('tasks')}(id,"organisationId",title,description,status,priority,"dueDate","assignedToId","createdById","candidateId","createdAt","updatedAt")
      select 'tk_'||i, '${o.id}', 'Task '||i, 'Do the thing '||i, (${pick(['TODO','TODO','IN_PROGRESS','COMPLETED','CANCELLED'])})::${E('TaskStatus')}, (${pick(['LOW','MEDIUM','MEDIUM','HIGH','URGENT'])})::${E('TaskPriority')}, ${ts(400)}, ${uarr}[1+floor(random()*${users.length})::int], ${uarr}[1+floor(random()*${users.length})::int], 'cd_'||(${off} + 1 + floor(random()*${k(N)})::int), ${ts()}, now()
      from ${gs(N_TASK)}`);
    for (let s = 0; s < k(N_NOTIF); s += CH) {
      const a = off + s + 1, b = off + Math.min(k(N_NOTIF), s + CH);
      await q(`notifications ${tag} ${s}`, `insert into ${T('notifications')}(id,"organisationId","userId",type,title,message,"readAt","createdAt")
        select 'nt_'||i, '${o.id}', ${uarr}[1+floor(random()*${users.length})::int], 'TASK_DUE', 'Notification '||i, 'Message '||i, case when random()<0.85 then now() else null end, ${ts(200)}
        from generate_series(${a}, ${b}) g(i)`);
    }
    for (let s = 0; s < k(N_AUD); s += CH) {
      const a = off + s + 1, b = off + Math.min(k(N_AUD), s + CH);
      await q(`audit_logs ${tag} ${s}`, `insert into ${T('audit_logs')}(id,"organisationId","userId",action,"entityType","entityId","createdAt")
        select 'au_'||i, '${o.id}', ${uarr}[1+floor(random()*${users.length})::int], ${pick(['create','update','delete'])}, ${pick(['candidate','job','company','application'])}, 'cd_'||(${off} + 1 + floor(random()*${k(N)})::int), ${ts()}
        from generate_series(${a}, ${b}) g(i)`);
    }
    await q(`placements ${tag}`, `insert into ${T('placements')}(id,"organisationId","candidateId","jobId","companyId","startDate",status,"ownerId","createdAt","updatedAt")
      select 'pl_'||i, '${o.id}', 'cd_'||(${off} + 1 + floor(random()*${k(N)})::int), 'jb_'||(${off} + 1 + floor(random()*${k(N_JOB)})::int), 'co_'||(${off} + 1 + floor(random()*${k(N_COMP)})::int), ${ts(700)}, (${pick(['ACTIVE','ACTIVE','COMPLETED','CANCELLED'])})::${E('PlacementStatus')}, ${owner(o.id)}, ${ts()}, now()
      from ${gs(N_PLC)}`);
  }
  const t = Date.now();
  await c.query('analyze');
  console.log(`ANALYZE ${((Date.now() - t) / 1000).toFixed(1)}s`);
  const cnt = await c.query(`select relname, n_live_tup from pg_stat_user_tables where schemaname='recruitment_crm' and n_live_tup>1000 order by n_live_tup desc`);
  console.log(cnt.rows.map((r) => `${r.relname}=${r.n_live_tup}`).join('  '));
  await c.end();
})().catch((e) => { console.error('SEED FAIL', e.message); process.exit(1); });
