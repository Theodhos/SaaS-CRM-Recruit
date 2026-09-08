import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Standard shadcn/ui class-merging helper, shared by every component here. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
