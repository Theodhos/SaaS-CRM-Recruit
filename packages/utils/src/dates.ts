const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * First instant (local time) of the oldest month `bucketDatesByMonth` counts. Dates before it can never land
 * in a bucket, so a query feeding that function can filter `gte` this without changing its result — the
 * boundary is built exactly like the bucket keys (`new Date(year, month - i, 1)`), in the same local zone.
 */
export function monthWindowStart(monthsBack = 6): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
}

/** Buckets dates into the last `monthsBack` calendar months (including the current one), oldest first, zero-filled so a trend chart never has gaps. */
export function bucketDatesByMonth(
  dates: Date[],
  monthsBack = 6,
): { month: string; count: number }[] {
  const now = new Date();
  const buckets: { key: string; month: string; count: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      count: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const date of dates) {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ month, count }) => ({ month, count }));
}
