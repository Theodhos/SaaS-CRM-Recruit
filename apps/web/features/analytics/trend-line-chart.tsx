'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES, CHART_SURFACE } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface TrendDatum {
  month: string;
  count: number;
}

/** Single series -> sequential hue (slot 1), no legend needed — the card title already says what's plotted. */
export function TrendLineChart({ data }: { data: TrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART_MUTED, fontSize: 12 }}
          width={32}
        />
        <Tooltip
          cursor={{ stroke: CHART_GRID }}
          content={({ active, label, payload }) => (
            <ChartTooltip
              active={active}
              label={label}
              payload={payload?.map((p) => ({
                name: 'Placements',
                value: p.value as number,
                color: CHART_SERIES[0],
              }))}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={CHART_SERIES[0]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={{ r: 4, fill: CHART_SERIES[0], stroke: CHART_SURFACE, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: CHART_SERIES[0], stroke: CHART_SURFACE, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
