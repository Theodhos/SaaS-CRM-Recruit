/** Attaches a `percentage` (of the group's total `count`, one decimal place) to each item — the one place this rounding happens, so every chart and report agrees. */
export function withPercentages<T extends { count: number }>(items: T[]): (T & { percentage: number })[] {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return items.map((item) => ({
    ...item,
    percentage: total === 0 ? 0 : Math.round((item.count / total) * 1000) / 10,
  }));
}

/** Placements (or any "successful outcome") as a percentage of attempts — the recurring conversion-rate shape across source/owner/company reports. */
export function conversionRate(outcomes: number, attempts: number): number {
  return attempts === 0 ? 0 : Math.round((outcomes / attempts) * 1000) / 10;
}
