# Load-test and measurement tooling

Reproduces the numbers in [`docs/operations/performance.md`](../../docs/operations/performance.md). It is **standalone** (its own
`package.json`, not part of the pnpm workspace) and runs against a **throw-away PostgreSQL that it starts itself** — never
against a real database. `seed-bulk.js` TRUNCATEs the entity tables; its connection string is hard-wired to
`localhost:54329` on purpose.

## Recipe

```bash
cd infrastructure/loadtest && npm install

# 1. a scratch PostgreSQL 16 on :54329 (data in ./data), keep this terminal open
node pg-server.js

# 2. schema + the project's own dev seed (users, roles, permissions, pipeline), in another terminal
export DATABASE_URL="postgresql://postgres:perf@localhost:54329/crm_perf?schema=recruitment_crm"
pnpm --filter @crm/database db:migrate:deploy
pnpm --filter @crm/database db:seed

# 3. synthetic volume on top of it (1,000,000 candidates + ~8M related rows; ~10 minutes)
node seed-bulk.js 1000000
# then make the data realistic (autovacuum does this in production) and give ~1/3 of candidates no application:
#   VACUUM (ANALYZE) on the big tables; delete applications of every 3rd candidate (disable RI triggers for speed)

# 4. run two API builds side by side on different ports against the SAME database, with statement counting
TAP_LOG=q-a.log TAP_CLIENT=<repo>/packages/database/src/generated/client API_PORT=4022 \
  node --require ./prisma-tap.js apps/api/dist-baseline/main.js
TAP_LOG=q-b.log ... API_PORT=4024 node --require ./prisma-tap.js apps/api/dist/main.js

# 5. compare
node ab.js http://localhost:4022 http://localhost:4024 q-a.log q-b.log 10     # interleaved A/B + response equality
node load.js http://localhost:4022 30 60 baseline                            # 30 virtual users for 60 s
node reports-once.js 4022 <pid>                                              # time + peak RSS of /reports/overview
node explain.js tap-full.jsonl 25 before                                    # EXPLAIN ANALYZE of the real SQL
node index-experiment.js tap-full.jsonl                                     # plans + row equality before/after new indexes
node ab-index.js tap-full.jsonl <queryKey>:<indexName>                      # one query with/without an index (DROP INDEX ... ROLLBACK)
```

## What each tool is for

| Tool | Purpose | Why it is built this way |
| --- | --- | --- |
| `prisma-tap.js` | counts (and, with `TAP_FULL`, records) every SQL statement Prisma issues | pre-seeds `globalThis.__crmPrismaClient`, so no project code is modified; **statement count is deterministic**, latency is not |
| `ab.js` | interleaved A/B (A,B,B,A,...) with response-body equality | sequential before/after runs were swung +-40% by cache warmth and background noise; interleaving cancels it (untouched endpoints land at x0.9-1.1) |
| `load.js` | N concurrent users on a weighted read mix; p50/p95/p99, throughput, errors | closed loop, no think time: the worst case for the server |
| `reports-once.js` | one timed call with peak RSS sampling | fresh process per variant, otherwise heap left over from earlier requests pollutes the number |
| `explain.js`, `index-experiment.js`, `ab-index.js` | plans, timings and row-for-row equality for candidate indexes | `DROP INDEX` inside a rolled-back transaction gives a clean with/without comparison on the same data |
| `bench.js` | single-run latency table + golden responses | superseded by `ab.js` for comparisons; handy for a quick look |

## Traps this tooling already fell into (so you do not)

* A background cron (overdue-task reminders) processed ~250k synthetic overdue tasks one by one and made every measurement look
  like hundreds of queries per request. Mark synthetic overdue tasks as already notified before measuring.
* If every synthetic candidate has an application, the "unassigned" list is empty and an index that is great for real data looks like
  a regression. Model realistic proportions.
* Git Bash rewrites arguments that look like POSIX paths (`^/users` becomes `^C:/Program Files/Git/users`): set `MSYS_NO_PATHCONV=1`.
