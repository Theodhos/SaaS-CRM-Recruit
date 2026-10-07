import { defineConfig } from 'tsup';

/**
 * The `@crm/*` workspace packages ship raw TypeScript as their entrypoint, so they cannot be
 * `require()`d from dist/ at runtime. Bundle them into the worker; third-party dependencies
 * (bullmq, ioredis, pino, zod, ...) stay external and are installed from package.json.
 */
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  target: 'node20',
  noExternal: [/^@crm\//],
});
