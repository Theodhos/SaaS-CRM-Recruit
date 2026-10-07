import { z } from 'zod';

/**
 * Single source of truth for environment variable shape + validation.
 * Every app calls `loadEnv()` once at bootstrap (see apps/api/src/config)
 * so misconfiguration fails fast with a readable error instead of silently
 * producing `undefined` deep inside a service.
 */

/**
 * `z.coerce.boolean()` runs `Boolean(value)` under the hood, so the string
 * "false" (non-empty) coerces to `true` — every boolean env var silently
 * became `true` regardless of its actual value. Parse the string instead.
 */
function booleanEnv(defaultValue: boolean) {
  return z.preprocess(
    (val) => (typeof val === 'string' ? val === 'true' : val),
    z.boolean().default(defaultValue),
  );
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // API
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_GLOBAL_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Web
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_REALTIME_URL: z.string().url().optional(),

  // Realtime
  REALTIME_PORT: z.coerce.number().default(4001),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().default(5),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_URL: z.string().optional(),
  DIRECT_DATABASE_URL: z.string().optional(),

  // Supabase (not consumed by application code yet — kept for future
  // Supabase Auth/API integration; validated here so a typo or missing
  // value fails fast at boot instead of surfacing as `undefined` later)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: booleanEnv(false),
  PASSWORD_SALT_ROUNDS: z.coerce.number().default(12),

  // Storage
  STORAGE_PROVIDER: z.enum(['s3', 'r2', 'minio', 'local']).default('s3'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().default('crm-documents'),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: booleanEnv(false),
  STORAGE_PUBLIC_URL: z.string().optional(),
  STORAGE_MAX_UPLOAD_MB: z.coerce.number().default(25),
  // Only used when STORAGE_PROVIDER=local (no Docker/MinIO or real S3/R2
  // credentials available in this dev environment — see LocalDiskStorageProvider).
  STORAGE_LOCAL_ROOT: z.string().default('./storage-uploads'),
  STORAGE_LOCAL_PUBLIC_BASE_URL: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'ses', 'sendgrid']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Recruitment CRM <no-reply@example.com>'),

  // Rate limiting
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(120),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

export type Env = z.infer<typeof envSchema>;
