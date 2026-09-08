import { envSchema, type Env } from './env.schema';

let cachedEnv: Env | undefined;

/**
 * Validates process.env against envSchema and caches the result. Call once
 * at app bootstrap (before anything reads process.env directly). Throws with
 * a readable, field-by-field message on failure so bad config is caught at
 * startup, not at first use deep in a request handler.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/** Test-only helper to reset the cache between test cases. */
export function __resetEnvCacheForTests(): void {
  cachedEnv = undefined;
}
