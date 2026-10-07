// Verifies that every built entrypoint can resolve all of its runtime dependencies — without starting it,
// and without needing Postgres / Redis.
//
// Why: the API, worker and realtime are bundled, but only `@crm/*` workspace code is inlined; third-party
// imports stay as `require("x")`. A package imported by bundled `@crm/*` code but not declared in the app's
// own package.json (e.g. `zod`) resolves fine in a dev checkout and then crashes on start in production with
// MODULE_NOT_FOUND. This check turns that into a CI failure.
//
//   node infrastructure/scripts/check-bundles.mjs [apps/api/dist/main.js ...]

import { readFileSync, existsSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaults = ['apps/api/dist/main.js', 'apps/worker/dist/main.js', 'apps/realtime/dist/main.js'];
const targets = (process.argv.length > 2 ? process.argv.slice(2) : defaults).map((p) => resolve(root, p));

const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
let failed = false;

for (const file of targets) {
  if (!existsSync(file)) {
    console.error(`MISSING BUILD  ${file} (run the build first)`);
    failed = true;
    continue;
  }
  const source = readFileSync(file, 'utf8');
  const specs = new Set();
  for (const m of source.matchAll(/require\((["'])([^"']+)\1\)/g)) {
    const spec = m[2];
    if (spec.startsWith('.') || spec.startsWith('/') || builtins.has(spec)) continue;
    specs.add(spec);
  }
  const req = createRequire(file);
  const missing = [];
  for (const spec of [...specs].sort()) {
    // `@crm/*` packages ship raw TypeScript: a surviving require() of one resolves to a .ts path that Node
    // cannot execute, so "resolves" is not good enough — they must have been bundled into the output.
    if (spec.startsWith('@crm/')) {
      missing.push(`${spec}  (workspace package left external — bundle it)`);
      continue;
    }
    try {
      req.resolve(spec);
    } catch {
      missing.push(spec);
    }
  }
  const rel = file.replace(root, '').replace(/^[\\/]/, '');
  if (missing.length) {
    failed = true;
    console.error(`FAIL  ${rel}: ${missing.length} unresolved of ${specs.size} external modules\n      ${missing.join('\n      ')}`);
    console.error(`      -> declare them in the app's package.json "dependencies" (the bundle imports them at runtime).`);
  } else {
    console.log(`ok    ${rel}: all ${specs.size} external modules resolve`);
  }
}

process.exit(failed ? 1 : 0);
