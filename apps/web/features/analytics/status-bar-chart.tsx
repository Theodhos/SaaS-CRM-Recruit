'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface StatusBarDatum {
  status: string;
  count: number;
  percentage: number;
}

/**
 * Part-to-whole across a handful of named categories -> horizontal bar, not
 * a pie (see dataviz skill's choosing-a-form.md) — reads at a glance, and
 * long status names never get squeezed into a slice label. Categorical
 * hues assigned by fixed slot order (rank position within this chart).
 */
export function StatusBarChart({ data }: { data: StatusBarDatum[] }) {
  const chartData = data.map((d, index) => ({
    ...d,
    label: d.status.replaceAll('_', ' '),
    fill: CHART_SERIES[index % CHART_SERIES.length],
  }));

  const height = Math.max(chartData.length * 40, 120);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
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
                name: 'Count',
                value: `${p.payload.count} (${p.payload.percentage}%)`,
                color: p.payload.fill,
              }))}
            />
          )}
        />
        <Bar dataKey="count" barSize={20} radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            // two pipelines can each have a stage with the same name, so the name alone is not a unique key
            <Cell key={`${entry.status}-${index}`} fill={CHART_SERIES[index % CHART_SERIES.length]} />
          ))}
          <LabelList
            dataKey="percentage"
            position="right"
            formatter={(value: unknown) => `${value}%`}
            style={{ fill: 'var(--chart-text-secondary)', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
