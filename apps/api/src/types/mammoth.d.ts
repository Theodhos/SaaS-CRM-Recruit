declare module 'mammoth' {
  export interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }

  export function extractRawText(input: { buffer: Buffer }): Promise<ExtractRawTextResult>;

  /** `.docx` as HTML (headings, lists, tables, embedded images as data URIs) — never scripts. */
  export function convertToHtml(input: { buffer: Buffer }): Promise<ExtractRawTextResult>;
}
