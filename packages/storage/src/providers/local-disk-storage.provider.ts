import { createHash } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';

import type {
  SignedUrlOptions,
  StorageObject,
  StorageProvider,
  UploadObjectInput,
} from '../storage.interface';

export interface LocalDiskStorageConfig {
  /** Directory files are written under — created on demand if missing. */
  rootDir: string;
  /** This API's own base URL (e.g. http://localhost:4010/api/v1) — download links point back at its own /storage/download route. */
  publicBaseUrl: string;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Base64url so an arbitrary key (which contains `/`) survives as a single, unambiguous URL path segment — no manual slash-escaping games. */
function encodeKeyForUrl(key: string): string {
  return Buffer.from(key, 'utf-8').toString('base64url');
}

/**
 * Dev/local stand-in for S3/R2/MinIO, behind the exact same StorageProvider
 * interface — switching to real object storage later is a config change
 * (`STORAGE_PROVIDER=s3`), not a code change. Used because this dev machine
 * has neither Docker (so no MinIO) nor real S3/R2 credentials.
 *
 * There is no such thing as a "presigned URL" for a local filesystem, so
 * `getDownloadUrl`/`getUploadUrl` both just point back at this API's own
 * `/storage/download/:encodedKey` route (see infrastructure/storage), which
 * streams the file after the normal JWT/tenant auth guards run — uploads
 * always go through the API's multipart endpoint, never directly to disk.
 */
export class LocalDiskStorageProvider implements StorageProvider {
  constructor(private readonly config: LocalDiskStorageConfig) {}

  private resolvePath(key: string): string {
    const root = resolve(this.config.rootDir);
    const target = resolve(root, key);
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`Refusing to access a path outside the storage root: ${key}`);
    }
    return target;
  }

  async upload(input: UploadObjectInput): Promise<StorageObject> {
    const path = this.resolvePath(input.key);
    await mkdir(dirname(path), { recursive: true });
    const body = Buffer.isBuffer(input.body)
      ? input.body
      : input.body instanceof Uint8Array
        ? Buffer.from(input.body)
        : await streamToBuffer(input.body);
    await writeFile(path, body);

    return {
      key: input.key,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      etag: createHash('md5').update(body).digest('hex'),
    };
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async getDownloadUrl(key: string, _options?: SignedUrlOptions): Promise<string> {
    return `${this.config.publicBaseUrl}/storage/download/${encodeKeyForUrl(key)}`;
  }

  async getUploadUrl(
    key: string,
    _contentType: string,
    _options?: SignedUrlOptions,
  ): Promise<string> {
    return `${this.config.publicBaseUrl}/storage/download/${encodeKeyForUrl(key)}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }
}
