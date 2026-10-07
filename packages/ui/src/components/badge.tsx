import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * A status has to be seen at a glance, so the badges that carry one are solid: blue = in progress (the default),
 * green = good / done, amber = waiting, red = stopped. `outline` stays quiet for labels that are not a status.
 * violet / orange / teal / slate give the pipeline's stages a colour of their own (see the web app's
 * features/pipelines/stage-colors.ts). Text on each fill clears 4.5:1.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white',
        success: 'bg-emerald-700 text-white',
        warning: 'bg-amber-400 text-slate-950',
        destructive: 'bg-red-600 text-white',
        violet: 'bg-violet-600 text-white',
        orange: 'bg-orange-700 text-white',
        teal: 'bg-teal-700 text-white',
        slate: 'bg-slate-600 text-white',
        outline: 'border border-border text-foreground/70',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
