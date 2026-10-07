/**
 * `@nestjs/config`'s `ConfigService.get()` resolves a key against raw
 * `process.env` (always a string) even when a matching key exists as a
 * proper boolean in a custom `load()` result — so `config.get<boolean>('X')`
 * can still hand back the string `"false"`, which every naive `if (value)`
 * or `Boolean(value)` check treats as truthy. Callers that read a boolean
 * env var through `ConfigService` should go through this instead of trusting
 * the generic type parameter.
 */
export function resolveBooleanConfig(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'string') return value === 'true';
  if (typeof value === 'boolean') return value;
  return defaultValue;
}
