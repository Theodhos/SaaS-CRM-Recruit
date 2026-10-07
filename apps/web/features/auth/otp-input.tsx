'use client';

import { cn } from '@crm/ui';
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

/**
 * One box per digit (six, or as many as the code has). Digits only; typing moves on to the next box, Backspace goes back, a pasted code
 * fills them all, and the phone shows its numeric keyboard (and offers the code from the message, where supported).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** All boxes filled. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  // emptied from outside (a wrong code, a new code): start again at the first box
  useEffect(() => {
    if (value === '' && !disabled) boxes.current[0]?.focus();
  }, [value, disabled]);

  function set(next: string, focus: number) {
    const digits = next.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    boxes.current[Math.min(focus, length - 1)]?.focus();
    if (digits.length === length) onComplete?.(digits);
  }

  function handleInput(index: number, typed: string) {
    const digits = typed.replace(/\D/g, '');
    if (!digits) return;
    // several digits at once: an autofill, or a paste some browsers deliver as input
    set(value.slice(0, index) + digits + value.slice(index + digits.length), index + digits.length);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) set(value.slice(0, index) + value.slice(index + 1), index);
      else if (index > 0) set(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      boxes.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      boxes.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (digits) set(digits, digits.length);
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code" data-testid="otp-input">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            boxes.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          className={cn(
            length > 6 ? 'h-11 w-9 text-lg' : 'h-12 w-11 text-xl',
            'rounded-md border bg-background text-center font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
            invalid ? 'border-destructive' : 'border-input',
          )}
        />
      ))}
    </div>
  );
}
