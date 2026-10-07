import { Check, ChevronDown, Search } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface SearchSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Placeholder of the search box. */
  searchPlaceholder?: string;
}

interface Option {
  value: string;
  label: string;
  disabled: boolean;
}

/** The text inside an <option> ("{first} {last}" arrives as several children). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** Every <option> among the children, through arrays, fragments and <optgroup>s. */
function optionsOf(children: React.ReactNode): Option[] {
  const options: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode; value?: string | number; disabled?: boolean }>(child)) return;
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      options.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
    } else {
      options.push(...optionsOf(child.props.children));
    }
  });
  return options;
}

/**
 * A <Select> for long lists (candidates, companies, jobs, users): opening it shows a search box first, and typing
 * narrows the options — every word typed must appear in the option, in any order. It is a drop-in for `Select`:
 * the same props and the same <option> children, and a real (visually hidden) <select> underneath keeps holding
 * the value, so `onChange={(e) => e.target.value}`, react-hook-form's `register` and form submission work unchanged.
 */
export const SearchSelect = React.forwardRef<HTMLSelectElement, SearchSelectProps>(
  ({ className, children, id, disabled, searchPlaceholder = 'Search…', ...props }, ref) => {
    const selectRef = React.useRef<HTMLSelectElement | null>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [active, setActive] = React.useState(0);
    // what the hidden <select> holds — it is the source of truth (it can also be set from outside, e.g. a form reset)
    const [current, setCurrent] = React.useState('');

    const options = optionsOf(children);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = words.length === 0 ? options : options.filter((o) => words.every((word) => o.label.toLowerCase().includes(word)));
    const selected = options.find((o) => o.value === current);

    // runs after every render on purpose: the value can change without an event (controlled value, form reset)
    React.useEffect(() => {
      const value = selectRef.current?.value ?? '';
      if (value !== current) setCurrent(value);
    });

    React.useEffect(() => {
      if (!open) return;
      const close = (event: MouseEvent) => {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }, [open]);

    React.useEffect(() => {
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    function toggle() {
      setQuery('');
      setActive(Math.max(0, options.findIndex((o) => o.value === current)));
      setOpen((isOpen) => !isOpen);
    }

    /** Sets the hidden <select> and fires its change event, exactly as if the user had picked the option in it. */
    function choose(option: Option) {
      const select = selectRef.current;
      if (select && !option.disabled) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, option.value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        setCurrent(option.value);
      }
      setOpen(false);
    }

    function onKeyDown(event: React.KeyboardEvent) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((index) => Math.min(Math.max(index + step, 0), Math.max(shown.length - 1, 0)));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (shown[active]) choose(shown[active]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }

    return (
      <div ref={rootRef} className="relative">
        <select
          ref={(node) => {
            selectRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          {...props}
        >
          {children}
        </select>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 pr-8 text-left text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? options[0]?.label ?? ''}</span>
        </button>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />

        {open ? (
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[14rem] rounded-md border border-border bg-background shadow-lg" onKeyDown={onKeyDown}>
            <div className="relative border-b border-border p-1.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/40" />
              <input
                autoFocus
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label="Search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                className="h-8 w-full rounded border border-input bg-background pl-7 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1 text-sm">
              {shown.length === 0 ? (
                <li className="px-3 py-2 text-foreground/50">No matches</li>
              ) : (
                shown.map((option, index) => (
                  <li
                    key={`${option.value}-${index}`}
                    role="option"
                    aria-selected={option.value === current}
                    aria-disabled={option.disabled}
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    // mousedown, not click: the search box must not lose focus (and close the list) first
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(option);
                    }}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5',
                      index === active && 'bg-accent text-accent-foreground',
                      option.disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === current ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    );
  },
);
SearchSelect.displayName = 'SearchSelect';
