import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  SignedUrlOptions,
  StorageObject,
  StorageProvider,
  UploadObjectInput,
} from '../storage.interface';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string; // set for R2 / MinIO; omit for AWS S3
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible implementation of StorageProvider. Works unmodified against
 * AWS S3, Cloudflare R2, and MinIO — they all speak the S3 API — by only
 * varying `endpoint` / `forcePathStyle` in config (see .env.example
 * STORAGE_* variables).
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });
  }

  async upload(input: UploadObjectInput): Promise<StorageObject> {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );

    return {
      key: input.key,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      etag: result.ETag,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresInSeconds ?? 900,
    });
  }

  async getUploadUrl(
    key: string,
    contentType: string,
    options?: SignedUrlOptions,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresInSeconds ?? 900,
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
