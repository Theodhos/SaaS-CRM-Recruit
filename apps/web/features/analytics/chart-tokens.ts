/**
 * Fixed categorical slot order (dataviz skill's validated reference
 * palette) — assign by position, never regenerate or cycle past slot 8.
 * Referenced as CSS custom properties (see packages/ui/styles/globals.css)
 * so light/dark swap automatically; recharts accepts `var(--x)` directly in
 * SVG fill/stroke since it renders real DOM nodes.
 */
export const CHART_SERIES = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)',
  'var(--chart-series-7)',
  'var(--chart-series-8)',
] as const;

export const CHART_TEXT_SECONDARY = 'var(--chart-text-secondary)';
export const CHART_MUTED = 'var(--chart-muted)';
export const CHART_GRID = 'var(--chart-grid)';
export const CHART_SURFACE = 'var(--chart-surface)';

/** Auto-compact large numbers for stat tiles / axis ticks: 1284 -> "1.3K". */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}
