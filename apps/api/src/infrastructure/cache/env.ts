/**
 * Reads a numeric environment variable, falling back to `fallback` when it is unset, empty, or not a finite
 * number. A malformed value (e.g. the string "undefined" after `process.env.X = undefined`) must never turn
 * into NaN, because every comparison against NaN is false and would silently disable the feature.
 */
export function envInt(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}
