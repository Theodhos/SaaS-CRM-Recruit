/**
 * A fresh password for an admin to hand to an instructor. Passwords are stored as one-way hashes, so an existing
 * password can never be displayed again — the admin sets a new one and it is shown exactly once.
 * 12 characters from an alphabet without look-alikes (no 0/O, 1/l/I), always containing a digit and a symbol.
 */
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';

function pick(alphabet: string, count: number): string {
  const values = new Uint32Array(count);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => alphabet[v % alphabet.length]).join('');
}

export function generatePassword(): string {
  const chars = [...pick(LETTERS, 9), ...pick(DIGITS, 2), ...pick(SYMBOLS, 1)];
  // shuffle so the digit/symbol are not always at the end
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  return chars
    .map((c, i) => [order[i] ?? 0, c] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => c)
    .join('');
}
