import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/** Native <select>, styled to match Input — deliberately not a Radix/headless combobox: this app has no field yet whose options don't fit a plain <select> (see packages/ui's shadcn-pattern note in button.tsx). */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
    </div>
  ),
);
Select.displayName = 'Select';
