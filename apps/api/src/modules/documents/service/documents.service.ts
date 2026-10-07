import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

import type { StorageProvider } from '@crm/storage';
import { totalPages } from '@crm/utils';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convertToHtml } from 'mammoth';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { resolveStorageLocalRoot } from '../../../infrastructure/storage/local-root';
import { STORAGE_PROVIDER } from '../../../infrastructure/storage/storage.constants';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CreateDocumentDto } from '../dto/create-document.dto';
import type { ListDocumentsQueryDto } from '../dto/list-documents-query.dto';
import { DocumentsRepository } from '../repositories/documents.repository';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/** What a browser can show as it is, by file extension. */
const INLINE_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

const PREVIEW_PAGE_STYLE =
  'body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:820px;margin:24px auto;padding:0 24px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px}';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repository: DocumentsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  private async withDownloadUrl<T extends { fileUrl: string }>(doc: T): Promise<T & { downloadUrl: string }> {
    // `fileUrl` stores the stable storage KEY, never a presigned URL — those
    // expire (900s for S3), so the actual download link is resolved fresh
    // on every read instead of being cached in the database.
    const downloadUrl = await this.storage.getDownloadUrl(doc.fileUrl);
    return { ...doc, downloadUrl };
  }

  async list(organisationId: string, query: ListDocumentsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items: await Promise.all(items.map((item) => this.withDownloadUrl(item))),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const document = await this.repository.findById(organisationId, id);
    if (!document) throw new ResourceNotFoundException('Document', id);
    return this.withDownloadUrl(document);
  }

  /**
   * The document in a form the browser can show inside the platform: PDF, image and text as they are, Word (.docx)
   * converted to an HTML page. Other formats cannot be previewed (download instead).
   */
  async preview(organisationId: string, id: string): Promise<{ body: Buffer; contentType: string }> {
    const document = await this.getById(organisationId, id);
    const extension = extname(document.fileUrl).toLowerCase();
    const inline = INLINE_CONTENT_TYPES[extension];
    if (!inline && extension !== '.docx') {
      throw new AppException(
        'PREVIEW_NOT_AVAILABLE',
        'This file type cannot be previewed — download it instead.',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const body = await this.readBytes(organisationId, document);
    if (inline) return { body, contentType: inline };

    const { value } = await convertToHtml({ buffer: body });
    const page = `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_PAGE_STYLE}</style></head><body>${value}</body></html>`;
    return { body: Buffer.from(page, 'utf-8'), contentType: 'text/html; charset=utf-8' };
  }

  /** Local disk is read directly; S3-compatible storage through the same short-lived link a download uses. */
  private async readBytes(organisationId: string, document: { id: string; fileUrl: string; downloadUrl: string }): Promise<Buffer> {
    try {
      if (this.config.get('STORAGE_PROVIDER', 's3') === 'local') {
        if (!document.fileUrl.startsWith(`${organisationId}/`) || document.fileUrl.includes('..')) throw new Error('key outside the tenant');
        return await readFile(join(resolveStorageLocalRoot(this.config), document.fileUrl));
      }
      const response = await fetch(document.downloadUrl);
      if (!response.ok) throw new Error(`storage answered ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch {
      throw new ResourceNotFoundException('Document file', document.id);
    }
  }

  async upload(
    organisationId: string,
    userId: string,
    dto: CreateDocumentDto,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    const key = `${organisationId}/documents/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      sizeBytes: file.size,
    });

    const document = await this.repository.create(organisationId, userId, {
      name: dto.name?.trim() || file.originalname,
      type: dto.type ?? 'OTHER',
      fileUrl: key,
      fileSize: file.size,
      companyId: dto.companyId,
      contactId: dto.contactId,
      jobId: dto.jobId,
      applicationId: dto.applicationId,
      candidateId: dto.candidateId,
      placementId: dto.placementId,
    });

    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_DOCUMENT',
      entityType: 'Document',
      entityId: document.id,
      newValues: { name: document.name, type: document.type, fileSize: document.fileSize },
    });

    return this.withDownloadUrl(document);
  }

  /**
   * Saves an edited version of a document (the CV editor: a PDF with text removed, or edited text) as a NEW document
   * beside the original: same type, same candidate / job / company…, named "<name> (edited <date time>)". The
   * original is never touched, so every edit leaves both the original and the edited file in the platform.
   */
  async saveEdited(organisationId: string, userId: string, id: string, file: { buffer: Buffer; size: number }) {
    const source = await this.getById(organisationId, id);
    const extension = extname(source.fileUrl).toLowerCase();
    if (extension !== '.pdf' && extension !== '.txt') {
      throw new AppException('EDIT_NOT_AVAILABLE', 'Only PDF and text files can be edited.', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    if (extension === '.pdf' && file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new AppException('INVALID_PDF', 'The edited file is not a PDF.', HttpStatus.BAD_REQUEST);
    }
    const stem = source.name.replace(/\.[^.]+$/, '').replace(/ \(edited[^)]*\)$/, '');
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const name = `${stem} (edited ${stamp})${extension}`;
    return this.upload(
      organisationId,
      userId,
      {
        name,
        type: source.type,
        companyId: source.companyId ?? undefined,
        contactId: source.contactId ?? undefined,
        jobId: source.jobId ?? undefined,
        applicationId: source.applicationId ?? undefined,
        candidateId: source.candidateId ?? undefined,
        placementId: source.placementId ?? undefined,
      } as CreateDocumentDto,
      { buffer: file.buffer, originalname: name, mimetype: INLINE_CONTENT_TYPES[extension]!, size: file.size },
    );
  }

  async remove(organisationId: string, userId: string, id: string) {
    const document = await this.getById(organisationId, id);
    await this.storage.delete(document.fileUrl);
    await this.repository.delete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_DOCUMENT',
      entityType: 'Document',
      entityId: id,
    });
  }
}

export { MAX_UPLOAD_SIZE_BYTES };
