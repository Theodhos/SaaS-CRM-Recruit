'use client';

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface RankingDatum {
  label: string;
  value: number;
}

/** One series ranked by magnitude -> single hue horizontal bar (not categorical — these bars are the same series, not distinct identities). */
export function RankingBarChart({
  data,
  valueLabel,
  emptyMessage,
  valueFormatter = (value) => String(value),
}: {
  data: RankingDatum[];
  valueLabel: string;
  emptyMessage: string;
  /** Formats the bar-end label and tooltip value — e.g. `(v) => \`${v}%\`` for a conversion-rate ranking. */
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-foreground/50">{emptyMessage}</p>;
  }

  const height = Math.max(data.length * 36, 120);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 8 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: CHART_GRID, opacity: 0.4 }}
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label}
              payload={payload?.map((p) => ({
                name: valueLabel,
                value: valueFormatter(p.value as number),
                color: CHART_SERIES[0],
              }))}
            />
          )}
        />
        <Bar dataKey="value" fill={CHART_SERIES[0]} barSize={18} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value: unknown) => valueFormatter(value as number)}
            style={{ fill: 'var(--chart-text-secondary)', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
