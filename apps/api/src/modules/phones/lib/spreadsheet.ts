import * as XLSX from 'xlsx';

import { parseCsv } from './csv';

/** An uploaded phones list: an Excel workbook (.xlsx / .xls / .xlsm) or, still accepted, a CSV exported from one. */
export interface UploadedTable {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

const EXCEL_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel',
]);

export const isExcelFile = (file: Pick<UploadedTable, 'originalname' | 'mimetype'>) =>
  /\.(xlsx|xlsm|xls)$/i.test(file.originalname) || (EXCEL_TYPES.has(file.mimetype) && !/\.csv$/i.test(file.originalname));

/**
 * The header line and the data rows of the uploaded list, whatever Excel saved it as. An Excel workbook is read
 * from its first sheet, cells as the text Excel shows (so a number typed as 0691234567 with a text format keeps its
 * zero, and a date stays a date); a CSV goes through the small RFC 4180 reader. Blank rows are dropped.
 */
export function readTable(file: UploadedTable): { headers: string[]; rows: string[][] } {
  if (!isExcelFile(file)) {
    const { headers, rows } = parseCsv(decode(file.buffer));
    return { headers, rows };
  }
  const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false, cellNF: false, cellText: true });
  const first = workbook.SheetNames[0];
  const sheet = first ? workbook.Sheets[first] : undefined;
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false });
  const headers = (matrix.shift() ?? []).map((cell) => String(cell ?? '').trim());
  const rows = matrix
    .map((cells) => headers.map((_, index) => String(cells[index] ?? '').trim()))
    .filter((cells) => cells.some((value) => value !== ''));
  return { headers, rows };
}

/** Excel exports are UTF-8 (often with a BOM) or the Windows code page; fall back when UTF-8 clearly isn't it. */
function decode(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  const replacements = (utf8.match(/�/g) ?? []).length;
  return replacements > 0 && replacements > utf8.length / 500 ? buffer.toString('latin1') : utf8;
}
