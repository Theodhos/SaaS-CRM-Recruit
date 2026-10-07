import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { CountryCode } from 'libphonenumber-js';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { TwilioVoiceService } from '../../../infrastructure/telephony/twilio-voice.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { ListPhonesQueryDto, UpdateCallDto } from '../dto';
import { csvLine, detectColumns } from '../lib/csv';
import { DEFAULT_COUNTRIES, normalizePhone } from '../lib/phone-number';
import { readTable } from '../lib/spreadsheet';
import { PhonesRepository, type NewPhoneRow } from '../repositories/phones.repository';

type RowStatus = 'valid' | 'invalid' | 'duplicate' | 'duplicate_in_file';

interface PreviewRow {
  row: number;
  name: string | null;
  phone: string;
  normalized: string | null;
  email: string | null;
  company: string | null;
  status: RowStatus;
  reason: string | null;
}

interface CachedPreview {
  organisationId: string;
  userId: string;
  fileName: string;
  rows: PreviewRow[];
  expiresAt: number;
}

const PREVIEW_TTL_MS = 30 * 60_000;
const IMPORT_CHUNK = 500;
const MAX_REPORTED_ERRORS = 2000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const STATUS_LABEL: Record<RowStatus, string> = { valid: 'Valid', invalid: 'Invalid', duplicate: 'Duplicate (already in Phones)', duplicate_in_file: 'Duplicate (repeated in the file)' };

/** Twilio's CallStatus values -> ours. */
const PROVIDER_STATUS: Record<string, 'INITIATED' | 'RINGING' | 'ANSWERED' | 'ENDED' | 'BUSY' | 'FAILED' | 'NO_ANSWER' | 'REJECTED'> = {
  queued: 'INITIATED',
  initiated: 'INITIATED',
  ringing: 'RINGING',
  'in-progress': 'ANSWERED',
  answered: 'ANSWERED',
  completed: 'ENDED',
  busy: 'BUSY',
  failed: 'FAILED',
  'no-answer': 'NO_ANSWER',
  canceled: 'REJECTED',
};

/**
 * Phones: a calling list per instructor, imported from Excel/CSV in two steps (preview -> confirm), searched and
 * filtered server-side, and called from the browser through the telephony provider. Every call is a PhoneCall row
 * whose status follows the provider's events; the phone row keeps a denormalised "last call" summary for the filters.
 */
@Injectable()
export class PhonesService {
  private readonly logger = new Logger(PhonesService.name);
  /** Parsed previews awaiting confirmation. In-process on purpose: a preview is a 30-minute, single-instance affair. */
  private readonly previews = new Map<string, CachedPreview>();

  constructor(
    private readonly repository: PhonesRepository,
    private readonly telephony: TwilioVoiceService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  capabilities() {
    const calling = this.telephony.isConfigured();
    return { calling, provider: calling ? 'twilio' : null, missing: calling ? [] : this.telephony.missingConfig(), countries: DEFAULT_COUNTRIES };
  }

  async list(organisationId: string, query: ListPhonesQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return { items, page: query.page, pageSize: query.pageSize, totalItems, totalPages: totalPages(totalItems, query.pageSize) };
  }

  async getById(organisationId: string, id: string) {
    const phone = await this.repository.findById(organisationId, id);
    if (!phone) throw new ResourceNotFoundException('Phone', id);
    return phone;
  }

  /** Removes a number from the list (soft delete — its call history stays for reporting). */
  async remove(organisationId: string, userId: string, id: string) {
    const phone = await this.getById(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({ organisationId, userId, action: 'DELETE_PHONE', entityType: 'Phone', entityId: id, oldValues: { phone: phone.normalizedPhone, name: phone.name } });
  }

  // ---- import ----------------------------------------------------------------------------------------------------

  /** Step 1: parse, normalise, validate and detect duplicates — nothing is written except the import record. */
  async previewImport(organisationId: string, userId: string, file: Express.Multer.File, defaultCountry: CountryCode) {
    if (file.size > MAX_FILE_BYTES) throw new AppException('FILE_TOO_LARGE', 'The Excel file must be smaller than 50 MB', HttpStatus.BAD_REQUEST);
    const { headers, rows } = readTable(file);
    if (headers.length === 0 || rows.length === 0) throw new AppException('EMPTY_FILE', 'The file has no data rows (first sheet)', HttpStatus.BAD_REQUEST);
    const columns = detectColumns(headers, rows);
    if (columns.phone === null) {
      throw new AppException('NO_PHONE_COLUMN', `No phone column found. Headers were: ${headers.join(', ')} — name the column "Phone" (or Telefon / Mobile / Tel).`, HttpStatus.BAD_REQUEST);
    }

    const seen = new Set<string>();
    const preview: PreviewRow[] = rows.map((cells, index) => {
      const get = (idx: number | null) => (idx === null ? null : (cells[idx] ?? '').trim() || null);
      const name = get(columns.name) ?? ([get(columns.firstName), get(columns.lastName)].filter(Boolean).join(' ') || null);
      const phone = get(columns.phone) ?? '';
      const email = get(columns.email)?.toLowerCase() ?? null;
      const company = get(columns.company);
      const normalized = normalizePhone(phone, defaultCountry);
      if (!normalized.ok) return { row: index + 2, name, phone, normalized: null, email, company, status: 'invalid', reason: normalized.reason };
      if (seen.has(normalized.e164)) return { row: index + 2, name, phone, normalized: normalized.e164, email, company, status: 'duplicate_in_file', reason: 'repeated in the file' };
      seen.add(normalized.e164);
      return { row: index + 2, name, phone, normalized: normalized.e164, email, company, status: 'valid', reason: null };
    });

    const existing = await this.repository.findExistingNormalized(organisationId, preview.filter((r) => r.status === 'valid').map((r) => r.normalized!));
    for (const r of preview) {
      if (r.status === 'valid' && existing.has(r.normalized!)) {
        r.status = 'duplicate';
        r.reason = 'already in Phones';
      }
    }

    const totals = {
      total: preview.length,
      valid: preview.filter((r) => r.status === 'valid').length,
      duplicates: preview.filter((r) => r.status === 'duplicate' || r.status === 'duplicate_in_file').length,
      invalid: preview.filter((r) => r.status === 'invalid').length,
    };
    const record = await this.repository.createImport(organisationId, userId, {
      fileName: file.originalname,
      defaultCountry,
      totalRows: totals.total,
      validRows: totals.valid,
      duplicateRows: totals.duplicates,
      invalidRows: totals.invalid,
    });
    this.pruneExpiredPreviews();
    this.previews.set(record.id, { organisationId, userId, fileName: file.originalname, rows: preview, expiresAt: Date.now() + PREVIEW_TTL_MS });

    return {
      importId: record.id,
      fileName: file.originalname,
      defaultCountry,
      columns: { phone: headers[columns.phone], name: columns.name !== null ? headers[columns.name] : null, email: columns.email !== null ? headers[columns.email] : null, company: columns.company !== null ? headers[columns.company] : null },
      totals,
      sample: preview.slice(0, 100).map((r) => ({ ...r, statusLabel: STATUS_LABEL[r.status] })),
    };
  }

  /** Step 2: write the valid rows in batches, in the background; poll `getImport` for progress. */
  async confirmImport(organisationId: string, userId: string, importId: string) {
    const record = await this.repository.findImport(organisationId, importId);
    if (!record) throw new ResourceNotFoundException('Import', importId);
    if (record.status !== 'PREVIEW') return record;
    const cached = this.previews.get(importId);
    if (!cached || cached.organisationId !== organisationId || cached.expiresAt < Date.now()) {
      this.previews.delete(importId);
      throw new AppException('PREVIEW_EXPIRED', 'This preview has expired — upload the file again.', HttpStatus.GONE);
    }
    const running = await this.repository.updateImport(organisationId, importId, { status: 'RUNNING' });
    void this.runImport(organisationId, userId, importId, cached).catch((error) => this.logger.error(`Phone import ${importId} crashed: ${error}`));
    return running;
  }

  private async runImport(organisationId: string, userId: string, importId: string, cached: CachedPreview) {
    const errors: { row: number; phone: string; reason: string }[] = [];
    for (const r of cached.rows) {
      if (r.status !== 'valid' && errors.length < MAX_REPORTED_ERRORS) errors.push({ row: r.row, phone: r.phone, reason: r.reason ?? STATUS_LABEL[r.status] });
    }
    const valid = cached.rows.filter((r) => r.status === 'valid');
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (let i = 0; i < valid.length; i += IMPORT_CHUNK) {
        const chunk = valid.slice(i, i + IMPORT_CHUNK);
        const links = await this.repository.findAssociations(
          organisationId,
          [...new Set(chunk.map((r) => r.email).filter((e): e is string => Boolean(e)))],
          [...new Set(chunk.map((r) => r.company).filter((c): c is string => Boolean(c)))],
        );
        const rows: NewPhoneRow[] = chunk.map((r) => ({
          name: r.name,
          phone: r.phone,
          normalizedPhone: r.normalized!,
          email: r.email,
          company: r.company,
          source: cached.fileName,
          importId,
          candidateId: r.email ? (links.candidateByEmail.get(r.email) ?? null) : null,
          contactId: r.email ? (links.contactByEmail.get(r.email) ?? null) : null,
          companyId: r.company ? (links.companyByName.get(r.company.toLowerCase()) ?? null) : null,
        }));
        try {
          const written = await this.repository.createMany(organisationId, rows);
          imported += written;
          skipped += rows.length - written;
        } catch (error) {
          failed += rows.length;
          this.logger.warn(`Phone import ${importId}: chunk at row ${chunk[0]!.row} failed: ${error}`);
          if (errors.length < MAX_REPORTED_ERRORS) errors.push({ row: chunk[0]!.row, phone: `${rows.length} rows`, reason: 'database error while inserting this batch' });
        }
        await this.repository.updateImport(organisationId, importId, { importedRows: imported, skippedRows: skipped, failedRows: failed });
        // yield so the event loop keeps serving requests between batches
        await new Promise((resolve) => setImmediate(resolve));
      }
      await this.repository.updateImport(organisationId, importId, { status: 'COMPLETED', importedRows: imported, skippedRows: skipped, failedRows: failed, errors, finishedAt: new Date() });
      await this.auditLogs.record({ organisationId, userId, action: 'IMPORT_PHONES', entityType: 'PhoneImport', entityId: importId, newValues: { fileName: cached.fileName, imported, skipped, failed } });
    } catch (error) {
      await this.repository.updateImport(organisationId, importId, { status: 'FAILED', importedRows: imported, skippedRows: skipped, failedRows: failed, errors, finishedAt: new Date() });
      throw error;
    } finally {
      this.previews.delete(importId);
    }
  }

  async getImport(organisationId: string, importId: string) {
    const record = await this.repository.findImport(organisationId, importId);
    if (!record) throw new ResourceNotFoundException('Import', importId);
    return record;
  }

  /** The rows that were not imported, as a CSV the user can open in Excel. */
  async errorReport(organisationId: string, importId: string) {
    const record = await this.getImport(organisationId, importId);
    const errors = (Array.isArray(record.errors) ? record.errors : []) as { row: number; phone: string; reason: string }[];
    const csv = [csvLine(['Row', 'Phone', 'Reason']), ...errors.map((e) => csvLine([e.row, e.phone, e.reason]))].join('\r\n');
    return { fileName: `${record.fileName.replace(/\.(csv|xlsx|xlsm|xls)$/i, '')}-errors.csv`, count: errors.length, csv };
  }

  private pruneExpiredPreviews() {
    const now = Date.now();
    for (const [id, p] of this.previews) if (p.expiresAt < now) this.previews.delete(id);
  }

  // ---- calls -----------------------------------------------------------------------------------------------------

  /** Creates the call record and hands the browser a token to dial with — never the provider credentials. */
  async startCall(organisationId: string, userId: string, phoneId: string) {
    const phone = await this.getById(organisationId, phoneId);
    if (phone.status === 'DO_NOT_CALL') throw new AppException('DO_NOT_CALL', 'This number is marked "do not call"', HttpStatus.BAD_REQUEST);
    if (!this.telephony.isConfigured()) {
      throw new AppException(
        'TELEPHONY_NOT_CONFIGURED',
        `Browser calling is not connected yet — add ${this.telephony.missingConfig().join(', ')} to the API environment (Twilio Programmable Voice).`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const call = await this.repository.createCall(organisationId, { phoneId, userId, provider: 'twilio' });
    await this.repository.refreshPhoneStats(organisationId, phoneId);
    return { call, token: this.telephony.accessToken(`user_${userId}`), to: phone.normalizedPhone, identity: `user_${userId}` };
  }

  /** The browser's view of the call (status while the webhook can't reach us, and the after-call note). */
  async updateCall(organisationId: string, callId: string, dto: UpdateCallDto) {
    const existing = await this.repository.findCall(organisationId, callId);
    if (!existing) throw new ResourceNotFoundException('Call', callId);
    const data: Record<string, unknown> = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status) {
      // a final provider status is never downgraded by a late browser update
      const final = ['ENDED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED'].includes(existing.status);
      if (!final || ['ENDED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED'].includes(dto.status)) data.status = dto.status;
      if (dto.status === 'ANSWERED' && !existing.answeredAt) data.answeredAt = dto.answeredAt ? new Date(dto.answeredAt) : new Date();
      if (['ENDED', 'NO_ANSWER', 'BUSY', 'FAILED', 'REJECTED'].includes(dto.status) && !existing.endedAt) {
        const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
        data.endedAt = endedAt;
        const answeredAt = (data.answeredAt as Date | undefined) ?? existing.answeredAt;
        data.durationSeconds = dto.durationSeconds ?? (answeredAt ? Math.max(0, Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000)) : 0);
      }
    }
    const call = await this.repository.updateCall(organisationId, callId, data);
    await this.repository.refreshPhoneStats(organisationId, existing.phoneId);
    return call;
  }

  /** Twilio asks what to do when the browser connects: bridge to the number of the call we created. */
  async twiml(params: { To?: string; CallId?: string; CallSid?: string }) {
    const call = params.CallId ? await this.repository.findCallForProvider({ id: params.CallId }) : null;
    if (!call || !params.To || call.phone.normalizedPhone !== params.To) {
      this.logger.warn(`TwiML requested for unknown call ${params.CallId ?? '-'} / ${params.To ?? '-'}`);
      return this.telephony.rejectTwiml('This call could not be placed.');
    }
    await this.repository.updateCall(call.organisationId, call.id, { providerCallId: params.CallSid ?? undefined, status: 'RINGING' });
    const callback = `${this.telephony.publicApiUrl()}/api/v1/phones/calls/webhook?callId=${encodeURIComponent(call.id)}`;
    return this.telephony.dialTwiml(call.phone.normalizedPhone, callback);
  }

  /** Provider status events — idempotent (sequence numbers) and keyed by our call id or the provider's. */
  async webhook(callId: string | undefined, body: Record<string, string>) {
    const call = callId
      ? await this.repository.findCallForProvider({ id: callId })
      : body.ParentCallSid || body.CallSid
        ? await this.repository.findCallForProvider({ providerCallId: body.ParentCallSid ?? body.CallSid })
        : null;
    if (!call) {
      this.logger.warn(`Webhook for unknown call ${callId ?? body.CallSid ?? '-'}`);
      return { handled: false };
    }
    const seq = body.SequenceNumber !== undefined ? Number(body.SequenceNumber) : null;
    if (seq !== null && call.lastEventSeq !== null && seq <= call.lastEventSeq) return { handled: true, duplicate: true };
    const status = PROVIDER_STATUS[body.CallStatus ?? ''];
    if (!status) return { handled: true, ignored: body.CallStatus };

    const now = body.Timestamp ? new Date(body.Timestamp) : new Date();
    const data: Record<string, unknown> = { lastEventSeq: seq ?? undefined };
    if (status === 'ANSWERED') {
      data.status = 'ANSWERED';
      if (!call.answeredAt) data.answeredAt = now;
    } else if (status === 'ENDED') {
      data.status = call.answeredAt || body.CallDuration ? 'ENDED' : 'NO_ANSWER';
      data.endedAt = now;
      data.durationSeconds = body.CallDuration !== undefined ? Number(body.CallDuration) : call.answeredAt ? Math.max(0, Math.round((now.getTime() - call.answeredAt.getTime()) / 1000)) : 0;
    } else if (['BUSY', 'FAILED', 'NO_ANSWER', 'REJECTED'].includes(status)) {
      data.status = status;
      data.endedAt = now;
      data.durationSeconds = 0;
    } else {
      data.status = status;
    }
    await this.repository.updateCall(call.organisationId, call.id, data);
    await this.repository.refreshPhoneStats(call.organisationId, call.phoneId);
    return { handled: true };
  }
}

