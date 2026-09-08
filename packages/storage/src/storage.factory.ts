import { S3StorageProvider, type S3StorageConfig } from './providers/s3-storage.provider';
import type { StorageProvider } from './storage.interface';

export interface StorageFactoryConfig extends S3StorageConfig {
  provider: 's3' | 'r2' | 'minio';
}

/**
 * Single place that decides which StorageProvider implementation to
 * construct. Consumers (apps/api, apps/worker) call this once at bootstrap
 * and depend on the returned StorageProvider interface from then on.
 */
export function createStorageProvider(config: StorageFactoryConfig): StorageProvider {
  switch (config.provider) {
    case 's3':
    case 'r2':
    case 'minio':
      return new S3StorageProvider(config);
    default:
      throw new Error(`Unsupported storage provider: ${String(config.provider)}`);
  }
}
