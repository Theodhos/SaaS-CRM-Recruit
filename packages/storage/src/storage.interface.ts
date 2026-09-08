import type { Readable } from 'node:stream';

/**
 * Vendor-agnostic contract every storage provider implements. Application
 * code (apps/api document/candidate-document services, apps/worker CV
 * parsing) depends ONLY on this interface — never on @aws-sdk/* directly —
 * so switching AWS S3 <-> Cloudflare R2 <-> MinIO is a config change, not a
 * code change. See docs/architecture/overview.md#file-storage.
 */
export interface UploadObjectInput {
  key: string;
  body: Buffer | Uint8Array | Readable;
  contentType: string;
  sizeBytes: number;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  sizeBytes: number;
  contentType: string;
  etag?: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
}

export interface StorageProvider {
  upload(input: UploadObjectInput): Promise<StorageObject>;
  delete(key: string): Promise<void>;
  getDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  getUploadUrl(key: string, contentType: string, options?: SignedUrlOptions): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
] as const;
