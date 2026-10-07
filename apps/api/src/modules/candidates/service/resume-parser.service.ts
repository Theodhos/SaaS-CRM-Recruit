import { BadRequestException, Injectable } from '@nestjs/common';
import { extractRawText } from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface ParsedResumeFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  currentCompany?: string;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,16}\d/;
const SKIP_HEADING = /^(curriculum vitae|resume|cv|profile|summary|objective|contact)$/i;
/** A short, capitalised line near the top of most résumés — the candidate's name. */
const NAME_LINE = /^[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ'-]+){0,3}$/;
/** "City, Country" / "City, Region" with no digits — a location line. */
const LOCATION_LINE = /^[A-Za-zÀ-ÿ.'\s-]{2,40},\s*[A-Za-zÀ-ÿ.'\s-]{2,40}$/;
/** "Senior Engineer at Acme" / "Senior Engineer @ Acme" / "Senior Engineer - Acme". */
const ROLE_AT_COMPANY = /^(.{2,80}?)\s+(?:at|@|-|\|)\s+(.{2,80})$/i;

@Injectable()
export class ResumeParserService {
  async extractText(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string> {
    const name = file.originalname.toLowerCase();

    if (name.endsWith('.pdf') || file.mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: file.buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    if (
      name.endsWith('.docx') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await extractRawText({ buffer: file.buffer });
      return result.value;
    }

    if (name.endsWith('.txt') || file.mimetype === 'text/plain') {
      return file.buffer.toString('utf-8');
    }

    throw new BadRequestException('Unsupported file type — upload a PDF, DOCX or TXT résumé.');
  }

  /**
   * Regex/heuristic extraction — no AI. Résumés vary wildly in layout, so
   * this only reliably catches email/phone; name/title/company/location are
   * best-effort and meant as a prefill the recruiter still reviews.
   */
  parse(text: string): ParsedResumeFields {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fields: ParsedResumeFields = {};

    // Matched per-line (not against the whole blob) so a phone/email match
    // can never bleed across a line break into unrelated footer text.
    for (const line of lines) {
      if (!fields.email) {
        const emailMatch = line.match(EMAIL_PATTERN);
        if (emailMatch) fields.email = emailMatch[0];
      }
      if (!fields.phone) {
        const phoneMatch = line.replace(EMAIL_PATTERN, '').match(PHONE_PATTERN);
        if (phoneMatch) fields.phone = phoneMatch[0].trim();
      }
      if (fields.email && fields.phone) break;
    }

    const nameIndex = lines.findIndex((line) => NAME_LINE.test(line) && !SKIP_HEADING.test(line));
    if (nameIndex !== -1) {
      const parts = lines[nameIndex]!.split(/\s+/);
      fields.firstName = parts[0];
      fields.lastName = parts.slice(1).join(' ') || undefined;
    }

    const searchStart = nameIndex === -1 ? 0 : nameIndex + 1;
    const nearbyLines = lines.slice(searchStart, searchStart + 6);
    let jobTitleLineIndex = -1;

    nearbyLines.forEach((line, index) => {
      if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) return;

      if (!fields.jobTitle) {
        const roleMatch = line.match(ROLE_AT_COMPANY);
        if (roleMatch) {
          fields.jobTitle = roleMatch[1]!.trim();
          fields.currentCompany = roleMatch[2]!.trim().split(',')[0]!.trim();
          return;
        }
      }

      if (!fields.location && LOCATION_LINE.test(line)) {
        fields.location = line;
        return;
      }

      // A short, comma-free line right after the job title (and not a
      // location) is most likely the employer's name on its own line.
      if (!fields.jobTitle && line.split(/\s+/).length <= 6) {
        fields.jobTitle = line;
        jobTitleLineIndex = index;
      } else if (
        !fields.currentCompany &&
        jobTitleLineIndex !== -1 &&
        index === jobTitleLineIndex + 1 &&
        !line.includes(',') &&
        line.split(/\s+/).length <= 6
      ) {
        fields.currentCompany = line;
      }
    });

    return fields;
  }
}
