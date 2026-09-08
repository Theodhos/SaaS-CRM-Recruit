import { loadEnv } from '@crm/config';

/**
 * Registered as the single ConfigModule loader (see app.module.ts) so every
 * service resolves config via NestJS's ConfigService rather than reading
 * process.env directly. Validation happens once here via @crm/config.
 */
export default () => loadEnv(process.env);
