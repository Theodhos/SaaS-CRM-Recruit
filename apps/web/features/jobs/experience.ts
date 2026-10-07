/** "3 – 5 years", "5+ years", "Up to 2 years", "No experience needed" — null when the job does not say. */
export function experienceLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  const hasMin = typeof min === 'number';
  const hasMax = typeof max === 'number';
  const years = (n: number) => (n === 1 ? 'year' : 'years');
  if (!hasMin && !hasMax) return null;
  if (hasMin && hasMax) {
    if (max === 0) return 'No experience needed';
    return min === max ? `${min} ${years(min)}` : `${min} – ${max} years`;
  }
  if (hasMin) return min === 0 ? 'No experience needed' : `${min}+ ${years(min)}`;
  return `Up to ${max} ${years(max as number)}`;
}
