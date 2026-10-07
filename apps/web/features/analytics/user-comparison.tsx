'use client';

import { Trophy } from 'lucide-react';

import { CHART_MUTED, CHART_SERIES } from './chart-tokens';

export interface UserComparisonRow {
  userId: string;
  name: string;
  companies: number;
  jobs: number;
  candidates: number;
  activeEmployees: number;
}

const MEASURES: { key: keyof Omit<UserComparisonRow, 'userId' | 'name'>; label: string }[] = [
  { key: 'companies', label: 'Companies' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'activeEmployees', label: 'Active employees' },
];

/** Past the palette's eight slots the rest share the muted tone — a hue is never generated. */
const colorOf = (index: number) => CHART_SERIES[index] ?? CHART_MUTED;

/**
 * The users side by side on what each one has added, readable without touching it: one row per user (their name
 * written out, in their colour), one column per measure, and in every cell the number next to a bar. Bars are
 * scaled within their own column, because the measures differ in size. The highest number of a column is marked.
 */
export function UserComparison({ rows }: { rows: UserComparisonRow[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-foreground/50">No users to compare yet.</p>;
  }
  const best = Object.fromEntries(MEASURES.map((m) => [m.key, Math.max(...rows.map((row) => row[m.key]))])) as Record<(typeof MEASURES)[number]['key'], number>;

  return (
    <div className="overflow-x-auto" data-testid="user-comparison">
      <table className="w-full min-w-[640px] border-separate border-spacing-x-4 border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-foreground/50">
            <th className="w-44 font-semibold">User</th>
            {MEASURES.map((measure) => (
              <th key={measure.key} className="font-semibold">
                {measure.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.userId} data-user={row.name}>
              <th className="whitespace-nowrap text-left font-medium">
                <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: colorOf(index) }} />
                {row.name}
              </th>
              {MEASURES.map((measure) => {
                const value = row[measure.key];
                const top = best[measure.key];
                const leads = top > 0 && value === top;
                return (
                  <td key={measure.key} data-measure={measure.key}>
                    <div className="flex items-center gap-2">
                      <div className="h-4 flex-1 rounded-sm bg-accent/60">
                        <div
                          className="h-4 rounded-r-[4px] rounded-l-sm"
                          style={{ width: `${top > 0 ? Math.max((value / top) * 100, value > 0 ? 3 : 0) : 0}%`, backgroundColor: colorOf(index) }}
                        />
                      </div>
                      <span className={`w-10 shrink-0 text-right tabular-nums ${leads ? 'font-bold' : ''}`}>{value}</span>
                      <span className="w-4 shrink-0">{leads ? <Trophy className="h-4 w-4 text-amber-500" aria-label="Highest" /> : null}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex items-center gap-1.5 px-4 text-xs text-foreground/50">
        <Trophy className="h-3.5 w-3.5 text-amber-500" /> the highest in that column
      </p>
    </div>
  );
}
