const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses a short duration string ("15m", "7d", "60s") into milliseconds, as used by JWT_*_EXPIRES_IN. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}" — expected a number followed by s/m/h/d`);
  }
  const [, amount, unit] = match;
  const unitMs = UNIT_MS[unit as string];
  if (!amount || !unitMs) {
    throw new Error(`Invalid duration "${value}" — expected a number followed by s/m/h/d`);
  }
  return Number(amount) * unitMs;
}
