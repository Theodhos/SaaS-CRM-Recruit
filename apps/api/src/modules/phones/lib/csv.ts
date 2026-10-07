/**
 * Small RFC 4180 reader for Excel exports: quoted fields, doubled quotes, CRLF, a UTF-8 BOM, and the delimiter
 * Excel used in that locale (`,` `;` tab or `|`) detected from the header line.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][]; delimiter: string } {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows, delimiter };
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export interface ColumnMap {
  phone: number | null;
  name: number | null;
  firstName: number | null;
  lastName: number | null;
  email: number | null;
  company: number | null;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ');
const PHONE_HEADERS = ['phone', 'phone number', 'phonenumber', 'mobile', 'mobile number', 'tel', 'telephone', 'telefon', 'telefoni', 'numri', 'numri i telefonit', 'number', 'cel', 'celular', 'gsm', 'nr', 'nr tel', 'contact number'];
const NAME_HEADERS = ['name', 'full name', 'fullname', 'emri', 'emri mbiemri', 'emri dhe mbiemri', 'contact', 'contact name', 'person', 'kandidati', 'candidate'];
const FIRST_HEADERS = ['first name', 'firstname', 'emri i pare', 'given name'];
const LAST_HEADERS = ['last name', 'lastname', 'surname', 'mbiemri', 'family name'];
const EMAIL_HEADERS = ['email', 'e mail', 'mail', 'email address', 'posta', 'posta elektronike'];
const COMPANY_HEADERS = ['company', 'company name', 'organisation', 'organization', 'kompania', 'firma', 'employer', 'biznesi', 'business'];

/** Which column holds what — by header name; when no phone header exists, the column whose values look most like numbers. */
export function detectColumns(headers: string[], rows: string[][]): ColumnMap {
  const find = (aliases: string[]) => {
    const idx = headers.findIndex((h) => aliases.includes(norm(h)));
    return idx === -1 ? null : idx;
  };
  const map: ColumnMap = {
    phone: find(PHONE_HEADERS),
    name: find(NAME_HEADERS),
    firstName: find(FIRST_HEADERS),
    lastName: find(LAST_HEADERS),
    email: find(EMAIL_HEADERS),
    company: find(COMPANY_HEADERS),
  };
  if (map.phone === null) {
    const sample = rows.slice(0, 50);
    let best: { idx: number; score: number } | null = null;
    headers.forEach((_, idx) => {
      const score = sample.filter((r) => /^[+\d][\d\s().-]{5,}$/.test((r[idx] ?? '').trim())).length;
      if (score > 0 && (!best || score > best.score)) best = { idx, score };
    });
    if (best) map.phone = (best as { idx: number }).idx;
  }
  return map;
}

/** One CSV line for the error report, safely quoted. */
export function csvLine(values: (string | number | null | undefined)[]): string {
  return values.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}
