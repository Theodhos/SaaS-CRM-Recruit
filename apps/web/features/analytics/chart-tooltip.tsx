'use client';

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number | string; color?: string; unit?: string }[];
}

/** Shared tooltip: values/labels stay in text tokens — only the swatch dot carries the series color. */
export function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      <div className="flex flex-col gap-0.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            {entry.color ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
            ) : null}
            <span className="text-foreground/70">{entry.name}:</span>
            <span className="font-medium text-foreground">
              {entry.value}
              {entry.unit ?? ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
